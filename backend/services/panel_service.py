#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Панель двух моделей: DeepSeek и Kimi думают параллельно, человеку уходит один ответ.

Зачем. Одна модель ошибается тихо: уверенно, складно и неверно. Второе мнение
ловит часть таких мест — другой провайдер, другие данные, другая формулировка
ответа на тот же вопрос.

Как устроено:
  1. оба ответа запрашиваются одновременно (asyncio.gather — параллельно, а не
     друг за другом: последовательность удвоила бы ожидание человека);
  2. если ответы почти совпали, синтез не нужен — уходит ответ DeepSeek, у
     которого голос Фреди;
  3. если расходятся — синтез делает DeepSeek по отдельному промпту: он берёт
     из ответа Kimi только то, что добавляет точность, факт или пропущенный
     вариант, и сохраняет свой голос. Поэтому стиль не «усредняется»;
  4. если одна из моделей молчит, панель вырождается в обычный одиночный
     ответ и не тратит третий вызов.

Настройки (env):
  PANEL_MODE=heavy|all|off   heavy — только режимы из PANEL_MODES (по умолчанию),
                             all — все разговорные, off — выключить панель
  PANEL_MODES=psychologist,coach,trainer
  PANEL_SIMILARITY=0.82      порог «ответы совпали»

Панель включается только когда есть оба ключа: DEEPSEEK_API_KEY и
MOONSHOT_API_KEY. Без Kimi она выключена и поведение прежнее.

Цена: два ответа вместо одного плюс синтез. Поэтому быстрый входной чат (basic)
в панель по умолчанию не входит: там таймаут важнее второго мнения.
"""

import asyncio
import difflib
import logging
import os
from typing import Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

DEFAULT_MODE = "heavy"
DEFAULT_PANEL_MODES = "psychologist,coach,trainer"
DEFAULT_SIMILARITY = 0.82

# Промпт синтеза. Ключевые решения:
#  * голос остаётся у DeepSeek — «не копируй второй ответ»;
#  * из второго берётся только прирост: точность, факт, вариант;
#  * расхождение не замазывается — если второй точнее, первый исправляется;
#  * запрет на «вторую модель» в тексте: человек получает один голос;
#  * объём не удваивается — иначе синтез превращается в простыню.
SYNTH_SYSTEM = (
    "Ты — Фреди, AI-психолог. Тебе дают твой ответ на сообщение человека и ответ "
    "второй модели на то же сообщение. Собери один ответ для человека.\n"
    "Правила:\n"
    "- голос, обращение и структура — твои; второй ответ не копируй и не пересказывай;\n"
    "- из второго бери только то, что добавляет точность, факт, недостающий вариант "
    "или второй взгляд;\n"
    "- если второй ответ точнее по существу — исправь свой, не защищая прежнюю "
    "формулировку;\n"
    "- ничего, чего нет ни в одном ответе, не добавляй;\n"
    "- не упоминай вторую модель, ИИ и панель — человек получает один ответ;\n"
    "- объём — как у твоего ответа, не удваивай;\n"
    "- верни только текст ответа, без пояснений."
)

# Второе мнение — не второй ответ, а дополнение к первому. Без этой приписки
# Kimi пишет ещё один полный текст: дольше, дороже и синтезу труднее выбрать.
SECONDARY_ADDON = (
    "\n\nДополнение к задаче: ты — второе мнение по тому же вопросу. "
    "Ответь коротко, 4-6 предложений: что стоит добавить, уточнить или поправить. "
    "Не переписывай ответ целиком и не повторяй очевидное."
)


def _mode_setting() -> str:
    return (os.environ.get("PANEL_MODE") or DEFAULT_MODE).strip().lower()


def enabled() -> bool:
    return _mode_setting() != "off"


def modes() -> set:
    raw = os.environ.get("PANEL_MODES") or DEFAULT_PANEL_MODES
    return {m.strip().lower() for m in raw.split(",") if m.strip()}


def mode_applies(mode: str) -> bool:
    """Идёт ли панель в этом режиме."""
    if not enabled():
        return False
    setting = _mode_setting()
    if setting == "all":
        return True
    return (mode or "").strip().lower() in modes()


def similarity_threshold() -> float:
    try:
        return float(os.environ.get("PANEL_SIMILARITY") or DEFAULT_SIMILARITY)
    except (TypeError, ValueError):
        return DEFAULT_SIMILARITY


def answer_similarity(first: str, second: str) -> float:
    """0..1 — насколько ответы совпадают по тексту (пробелы и регистр не в счёт)."""
    if not first or not second:
        return 0.0
    a = " ".join(first.lower().split())
    b = " ".join(second.lower().split())
    return difflib.SequenceMatcher(None, a, b).ratio()


def secondary_tokens(max_tokens: int) -> int:
    """Бюджет для второго мнения: коротко и дёшево, но не меньше 200.

    Замер 06.11.2026: полный ответ Kimi с рассуждением занимал 15-19 с. Второму
    мнению столько не нужно — оно добавляет факты, а не пишет второй текст.
    """
    try:
        cap = int(os.environ.get("PANEL_SECONDARY_TOKENS") or 400)
    except (TypeError, ValueError):
        cap = 400
    try:
        wanted = int(max_tokens or cap)
    except (TypeError, ValueError):
        wanted = cap
    return max(200, min(wanted, cap))


def secondary_timeout() -> float:
    """Сколько ждём второе мнение. Дольше — панель вырождается в один ответ.

    Замер: короткое второе мнение Kimi шло 15 с, тяжёлое — больше. Основной
    ответ ждать не обязан: если Kimi не успела, уходит ответ DeepSeek.
    """
    try:
        return max(0.1, float(os.environ.get("PANEL_SECONDARY_TIMEOUT") or 50))
    except (TypeError, ValueError):
        return 50.0


def build_synth_user(user_prompt: str, primary: str, secondary: str) -> str:
    """Склейка без .format: в тексте человека могут быть фигурные скобки."""
    return ("СООБЩЕНИЕ ЧЕЛОВЕКА:\n" + user_prompt +
            "\n\nТВОЙ ОТВЕТ:\n" + primary +
            "\n\nОТВЕТ ВТОРОЙ МОДЕЛИ:\n" + secondary)


async def discuss(
    primary: Callable[[], Awaitable[Optional[str]]],
    secondary: Callable[[], Awaitable[Optional[str]]],
    synthesize: Callable[[str, str], Awaitable[Optional[str]]],
    user_prompt: str,
    mode: str = "",
) -> Optional[str]:
    """Два ответа параллельно, затем решение: синтез или готовый ответ.

    primary   — основная модель (её голос и остаётся);
    secondary — второе мнение;
    synthesize(system_prompt, user_prompt) — сборка (основная модель);
    None — обе модели молчат, вызывающий код идёт прежним путём (заглушка).
    """
    # Второе мнение ограничиваем по времени: без этого медленная Kimi держит
    # основной ответ (gather ждёт обоих), и человек видит паузу вместо ответа.
    async def _limited(coro):
        try:
            return await asyncio.wait_for(coro, timeout=secondary_timeout())
        except asyncio.TimeoutError:
            logger.warning("🟠 PANEL: второе мнение не уложилось в %s с",
                           int(secondary_timeout()))
            return None

    try:
        p, s = await asyncio.gather(primary(), _limited(secondary()),
                                    return_exceptions=True)
    except Exception:  # noqa: BLE001 — панель не должна ронять основной путь
        p, s = None, None
    if isinstance(p, Exception):
        logger.warning("🟠 PANEL: основная модель упала: %s", p)
        p = None
    if isinstance(s, Exception):
        logger.warning("🟠 PANEL: вторая модель упала: %s", s)
        s = None
    p = (p or "").strip()
    s = (s or "").strip()

    if not p and not s:
        logger.warning("🟠 PANEL: обе модели молчат")
        return None
    if not s:
        logger.warning("🟠 PANEL: второго ответа нет, отдаю основной (%d знаков)", len(p))
        return p or None
    if not p:
        logger.warning("🟠 PANEL: основного ответа нет, отдаю второй (%d знаков)", len(s))
        return s or None

    ratio = answer_similarity(p, s)
    if ratio >= similarity_threshold():
        logger.warning("🟢 PANEL: ответы совпали (%.2f), синтез не нужен", ratio)
        return p

    synth_user = build_synth_user(user_prompt, p, s)
    merged = (await synthesize(SYNTH_SYSTEM, synth_user) or "").strip()
    if not merged:
        logger.warning("🟠 PANEL: синтез не удался, отдаю основной ответ (%d знаков)", len(p))
        return p
    logger.warning(
        "🟢 PANEL mode=%s: расхождение %.2f, основной %d / второй %d → итог %d знаков",
        mode or "?", ratio, len(p), len(s), len(merged))
    return merged
