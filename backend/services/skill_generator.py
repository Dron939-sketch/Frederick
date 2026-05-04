"""
skill_generator.py — генерация конфайн-модели + 21-дневного плана для
кастомного навыка через Anthropic.

UX-логика:
  • Юзер вводит свой навык в input → фронт зовёт /api/skill-plan/generate.
  • Бэк: ищет в БД по нормализованному ключу — если кэш есть, возвращает.
  • Иначе: один Anthropic-вызов с эталонным prompt'ом (confidence как
    образец JSON-структуры), парсинг, валидация, сохранение в кэш.
  • Если генерация / парсинг провалились — отдаём None, фронт уходит на
    универсальный DEFAULT_TEMPLATE_PLAN.

Кэш — глобальный (без user_id). Один и тот же текст «бросить курить»
от двух разных юзеров вернёт один и тот же сгенерированный план.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ============================================================
# DDL — создаётся в init_skill_plan_tables (skill_plan_routes.py)
# ============================================================

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS fredi_custom_skill_plans (
    skill_key  TEXT PRIMARY KEY,
    skill_name TEXT NOT NULL,
    plan       JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
"""


def _normalize_key(name: str) -> str:
    """Ключ для поиска в кэше: lowercase, без знаков, по строчным словам."""
    if not name:
        return ""
    s = name.strip().lower()
    s = re.sub(r"[^\wа-яёa-z0-9 ]+", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120]


# ============================================================
# Эталонный prompt — JSON-схема + образец confidence
# ============================================================

# Эталон confidence (сокращённый, чтобы prompt влез в budget). Полный
# конфайн-пример показывает структуру; LLM повторит её для нового навыка.
_GOLD_EXAMPLE = {
    "model": {
        "result": {
            "icon": "🎯",
            "title": "Результат",
            "subtitle": "что мастер-модель видит / слышит / чувствует, когда у него получилось",
            "text": "Спокойный голос грудного диапазона, прямой взгляд без напряжения, паузы между фразами. Внутри — ясное «я в своём праве», тело расслаблено."
        },
        "trigger": {
            "icon": "🔔",
            "title": "Триггер запуска",
            "subtitle": "сенсорный сигнал, на котором стратегия включается автоматически",
            "text": "Внешний — чужая просьба, давление, скептический взгляд. Внутренний — телесный сигнал «съёжился»: поднявшиеся плечи, секундная задержка дыхания."
        },
        "tote": {
            "icon": "🔄",
            "title": "Последовательность (TOTE)",
            "subtitle": "пошаговый алгоритм действия",
            "text": "Test (вход) — заметил телесный сигнал давления. Operate — пауза 3 секунды, перенос веса на стопы, выдох. Test (проверка) — что я хочу сказать? Если ясно — говорю. Exit — вышел с ощущением «остался собой»."
        },
        "checkpoints": {
            "icon": "📊",
            "title": "ВАК-чекпоинты",
            "subtitle": "сенсорные метки внутри цикла, по которым мастер-модель сверяется",
            "text": "Дыхание ровное. Плечи опустились. Глаз не убежал. Голос грудной, не зажат в горле."
        },
        "features": {
            "icon": "✨",
            "title": "Фишки мастер-модели",
            "subtitle": "специфические приёмы, отличающие её от обычной стратегии",
            "text": "Лёгкая улыбка глазами в момент паузы. Повтор той же фразы тем же тоном при давлении. Перенос внимания на стопы. Короткие предложения без «но / просто»."
        },
        "values": {
            "icon": "💎",
            "title": "Ценности и убеждения",
            "subtitle": "что мастер-модель считает истинным, и без чего стратегия не работает",
            "text": "«Моё мнение имеет ту же ценность, что и любое другое». «Отказ — нормальная часть отношений». «Я не обязан объяснять каждое решение»."
        },
        "filters": {
            "icon": "🔍",
            "title": "Фильтры восприятия",
            "subtitle": "что мастер-модель замечает / на что не обращает внимания",
            "text": "Замечает: тон, движение глаз, паузы. Фильтрует: эмоциональный нажим, попытки вызвать вину. Главный фильтр: «это про меня или про их состояние?»"
        },
        "benefits": {
            "icon": "🎁",
            "title": "Вторичные выгоды",
            "subtitle": "что приходит бонусом к основному результату",
            "text": "Тело меньше устаёт. Лучше сон. Окружение перестаёт «нагружать по умолчанию». Растёт круг тех, кто обращается за честным мнением."
        },
        "identity": {
            "icon": "👤",
            "title": "Самоидентификация",
            "subtitle": "за кого мастер-модель себя считает, чтобы получать такой результат",
            "text": "Не «жёсткий» и не «удобный», а свободный. Свобода = «могу сказать да и могу сказать нет, и оба варианта — мои»."
        }
    },
    "transitions": [
        {"key": "Услышать сигнал «съёжился» до того, как ответил «да»",
         "explain": "Без замечания телесного сигнала за 1–2 секунды до реакции выбора нет.",
         "days": [2, 3, 4]},
        {"key": "Перевести «я не имею права» в «отказ — часть отношений»",
         "explain": "Главное убеждение мастер-модели.",
         "days": [5, 11, 12]}
    ]
}


def _build_prompt(skill_name: str) -> str:
    """Prompt: задаём строгую JSON-схему + эталон confidence + просьба для нового навыка."""
    example = json.dumps(_GOLD_EXAMPLE, ensure_ascii=False, indent=2)

    return f"""Ты — эксперт по моделированию навыков (НЛП-моделирование, 9-элементная конфайн-модель).
Тебе дано название навыка от пользователя. Нужно вернуть JSON со ВСЕЙ карточкой навыка по строгой схеме.

НАВЫК ПОЛЬЗОВАТЕЛЯ: «{skill_name}»

СТРОГАЯ СХЕМА ОТВЕТА (ровно эти ключи, ровно эта вложенность):
{{
  "model": {{
    "result":      {{"icon":"🎯","title":"Результат","subtitle":"...","text":"..."}},
    "trigger":     {{"icon":"🔔","title":"Триггер запуска","subtitle":"...","text":"..."}},
    "tote":        {{"icon":"🔄","title":"Последовательность (TOTE)","subtitle":"...","text":"..."}},
    "checkpoints": {{"icon":"📊","title":"ВАК-чекпоинты","subtitle":"...","text":"..."}},
    "features":    {{"icon":"✨","title":"Фишки мастер-модели","subtitle":"...","text":"..."}},
    "values":      {{"icon":"💎","title":"Ценности и убеждения","subtitle":"...","text":"..."}},
    "filters":     {{"icon":"🔍","title":"Фильтры восприятия","subtitle":"...","text":"..."}},
    "benefits":    {{"icon":"🎁","title":"Вторичные выгоды","subtitle":"...","text":"..."}},
    "identity":    {{"icon":"👤","title":"Самоидентификация","subtitle":"...","text":"..."}}
  }},
  "transitions": [
    {{"key":"...","explain":"...","days":[N1,N2,...]}},
    ... (4–5 точек, days — числа от 1 до 21)
  ],
  "plan": {{
    "weeks": [
      {{"theme":"Знакомство и калибровка",   "meaning":"...", "exercises":[ {{...день 1...}}, ..., {{...день 7...}} ]}},
      {{"theme":"Активная тренировка",        "meaning":"...", "exercises":[ {{...день 8...}}, ..., {{...день 14...}} ]}},
      {{"theme":"Закрепление и интеграция",   "meaning":"...", "exercises":[ {{...день 15...}}, ..., {{...день 21...}} ]}}
    ]
  }}
}}

КАРКАС 21 ДНЯ (точно эти функции для каждого дня — варьируй только содержание под навык):
1 мотивация-якорь · 2 пассивное наблюдение · 3 триггеры · 4 безопасная микро-попытка · 5 аффект-маркировка
6 повтор с поправкой · 7 итог недели 1 · 8 прогрессивная нагрузка · 9 телесная метка · 10 среда
11 социальная опора · 12 худший момент + совет другу · 13 лёгкая победа с фиксацией · 14 половина пути
15 естественная среда · 16 спонтанный момент · 17 перенос в новый контекст · 18 растяжение
19 своё определение · 20 письмо себе через год · 21 было/стало

КАЖДОЕ exercise имеет ровно эти поля:
{{"day": N, "task": "короткое название", "dur": "X мин", "inst": "что делать (2–3 предложения)", "why": "зачем именно сегодня именно это (1–2 предложения)"}}

ТРЕБОВАНИЯ К ТОНУ:
• Нейтрально-психологический, на «вы», без эзотерики и NLP-сленга.
• Конкретно — реальные ситуации навыка, а не абстрактные «упражнения».
• Без слова «мастер» в одиночку — только «мастер-модель» или без.
• Этическая граница: если навык про влияние/манипуляцию — обязательно явное ограничение «не во вред слушающему».

ЭТАЛОННЫЙ ОБРАЗЕЦ структуры (для навыка «Уверенность в себе» — повтори ту же глубину для нового навыка):
{example}

ВАЖНО:
• Верни ТОЛЬКО JSON без markdown-обёртки и без комментариев.
• Все 21 день должны быть. Все 9 элементов модели должны быть. Минимум 4 transition.
• Если название навыка непонятное / абсурдное / не похоже на навык — всё равно сделай попытку, ориентируясь на ближайшее понятное.
"""


# ============================================================
# Парсинг + валидация ответа LLM
# ============================================================

_REQUIRED_MODEL_KEYS = (
    "result", "trigger", "tote", "checkpoints",
    "features", "values", "filters", "benefits", "identity",
)
_REQUIRED_ELEM_FIELDS = ("icon", "title", "subtitle", "text")
_REQUIRED_EX_FIELDS = ("day", "task", "dur", "inst", "why")


def _strip_md_fence(raw: str) -> str:
    """Убираем ```json…``` обёртку, если LLM её вернула вопреки запросу."""
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s


def _parse_and_validate(raw: str) -> Optional[Dict[str, Any]]:
    """Возвращает валидный dict {model, transitions, plan} или None."""
    if not raw:
        return None
    text = _strip_md_fence(raw)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        # Пытаемся вытянуть только JSON-объект из текста — иногда LLM
        # добавляет предисловие, несмотря на запрет.
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            logger.warning(f"skill_generator: not a JSON: {e}; raw[:200]={raw[:200]}")
            return None
        try:
            data = json.loads(m.group(0))
        except Exception as e2:
            logger.warning(f"skill_generator: extracted JSON also bad: {e2}")
            return None

    if not isinstance(data, dict):
        return None

    model = data.get("model")
    transitions = data.get("transitions")
    plan = data.get("plan")
    if not isinstance(model, dict) or not isinstance(transitions, list) or not isinstance(plan, dict):
        logger.warning("skill_generator: missing model/transitions/plan top-level")
        return None

    # Все 9 элементов модели
    for k in _REQUIRED_MODEL_KEYS:
        elem = model.get(k)
        if not isinstance(elem, dict):
            logger.warning(f"skill_generator: model.{k} missing")
            return None
        for f in _REQUIRED_ELEM_FIELDS:
            if not isinstance(elem.get(f), str) or not elem.get(f).strip():
                logger.warning(f"skill_generator: model.{k}.{f} missing/empty")
                return None

    # Хотя бы 4 точки перехода с днями
    if len(transitions) < 4:
        logger.warning(f"skill_generator: only {len(transitions)} transitions")
        return None
    for t in transitions:
        if not isinstance(t, dict) or not t.get("key") or not isinstance(t.get("days"), list):
            logger.warning(f"skill_generator: bad transition: {t}")
            return None

    # 3 недели × 7 дней
    weeks = plan.get("weeks")
    if not isinstance(weeks, list) or len(weeks) != 3:
        logger.warning("skill_generator: plan.weeks must have exactly 3 entries")
        return None
    days_seen = set()
    for w in weeks:
        if not isinstance(w, dict) or not w.get("theme") or not w.get("meaning"):
            logger.warning("skill_generator: week missing theme/meaning")
            return None
        exs = w.get("exercises")
        if not isinstance(exs, list) or len(exs) != 7:
            logger.warning(f"skill_generator: week has {len(exs) if isinstance(exs, list) else '?'} exercises, expected 7")
            return None
        for ex in exs:
            if not isinstance(ex, dict):
                return None
            for f in _REQUIRED_EX_FIELDS:
                if ex.get(f) is None or (isinstance(ex.get(f), str) and not ex.get(f).strip()):
                    logger.warning(f"skill_generator: exercise field {f} missing")
                    return None
            try:
                d = int(ex["day"])
            except Exception:
                return None
            if d < 1 or d > 21:
                return None
            days_seen.add(d)

    if days_seen != set(range(1, 22)):
        logger.warning(f"skill_generator: days mismatch — got {sorted(days_seen)[:5]}..., expected 1..21")
        return None

    return data


# ============================================================
# Главная функция
# ============================================================

async def generate_custom_plan(db, skill_name: str) -> Optional[Dict[str, Any]]:
    """Возвращает {model, transitions, plan} для кастомного навыка.

    Пайплайн:
      1) Cache lookup по нормализованному ключу.
      2) Если miss — Anthropic call → parse → validate → cache → вернуть.
      3) Если генерация/парсинг упали — None (фронт уйдёт на DEFAULT).
    """
    if not skill_name or not skill_name.strip():
        return None

    key = _normalize_key(skill_name)
    if not key:
        return None

    # 1) Cache
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT plan FROM fredi_custom_skill_plans WHERE skill_key = $1", key
            )
        if row and row["plan"]:
            data = row["plan"]
            if isinstance(data, str):
                data = json.loads(data)
            logger.info(f"skill_generator: cache HIT for «{skill_name}» (key={key})")
            return data
    except Exception as e:
        logger.warning(f"skill_generator: cache read failed for {key}: {e}")

    # 2) Anthropic call
    try:
        from services.anthropic_client import call_anthropic, is_available
        if not is_available():
            logger.warning("skill_generator: ANTHROPIC_API_KEY missing")
            return None

        prompt = _build_prompt(skill_name.strip())
        # Полная карточка тяжёлая: 9 элементов × ~80 слов + 21 день × ~50 слов + 5 переходов.
        # 4000 токенов с запасом, temperature низкая для стабильной структуры.
        raw = await call_anthropic(prompt, max_tokens=4000, temperature=0.4)
        if not raw:
            logger.warning(f"skill_generator: empty response for «{skill_name}»")
            return None
    except Exception as e:
        logger.error(f"skill_generator: Anthropic call failed for «{skill_name}»: {e}")
        return None

    # 3) Parse + validate
    data = _parse_and_validate(raw)
    if not data:
        logger.warning(f"skill_generator: validation failed for «{skill_name}»; raw[:300]={raw[:300]}")
        return None

    # 4) Cache
    try:
        payload = json.dumps(data, ensure_ascii=False, default=str)
        async with db.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO fredi_custom_skill_plans (skill_key, skill_name, plan)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (skill_key) DO UPDATE SET plan = EXCLUDED.plan
                """,
                key, skill_name.strip()[:200], payload,
            )
        logger.info(f"skill_generator: GENERATED + cached for «{skill_name}» (key={key})")
    except Exception as e:
        logger.warning(f"skill_generator: cache write failed for {key}: {e}")

    return data
