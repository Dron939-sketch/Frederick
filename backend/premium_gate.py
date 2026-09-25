# -*- coding: utf-8 -*-
"""Три бесплатных ответа коуча и тренера, дальше — только с подпиской.

Решение владельца 12.09.2026. До этого _enforce_premium_mode пускал в
премиум-роли всех, у кого не кончились бесплатные минуты, а потом молча
понижал до basic: человек не понимал, почему «коуч» вдруг отвечает как
Бендер. Теперь у коуча и тренера ровно FREE_ANSWERS ответов на аккаунт
без подписки — и они должны быть лучшими, какие есть (полные параметры
генерации, без урезаний). С четвёртого сообщения модель не зовётся:
человек получает один и тот же текст про подписку, который сохраняется в
историю под тем же режимом, но в счётчик не попадает.

Считаем по fredi_messages: ответы ассистента с metadata.mode из LOCK_MODES,
чей текст не начинается с LOCK_PREFIX. Подписчика счётчик не касается.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

FREE_ANSWERS = 3
LOCK_MODES = ("coach", "trainer")

_MODE_TITLES = {"coach": "Коуч", "trainer": "Тренер"}

# По этому началу текста замок узнаётся в истории и не считается ответом.
LOCK_PREFIX = "Режим «"


def lock_text(mode: str) -> str:
    """Строка замка. Начинается с LOCK_PREFIX — по нему её узнаёт счётчик.

    18.09.2026, две правки по выгрузке диалогов 11–17.09.

    Цена. Здесь стояло «первая неделя 290 ₽» — тариф, которого нет с
    15.09: проба стоит 69 ₽ за три дня с 22.09 (backend/payment.py). Четыре
    человека за неделю прочитали в этом тексте цену, которой не было.

    Тон. Прежний текст был единственным, что человек получал на свой
    вопрос: «Посоветуй книгу» — замок, «разбери сон» — замок, «ничего не
    поняла, что мне делать» — тот же замок в третий раз. Теперь замок —
    одна строка ПЕРЕД ответом, а сам ответ даёт LockedMode через
    fallback (обычный Фреди), см. ниже.
    """
    title = _MODE_TITLES.get(mode, mode.capitalize())
    # Цены — из PLANS: вписанная руками цена уже расходилась с кассой (22.09.2026).
    from payment import plan_price
    return (
        f"{LOCK_PREFIX}{title}» дальше работает по подписке — три бесплатных "
        f"ответа в нём вы уже получили. Проба на 3 дня стоит {plan_price('trial_week')} ₽, "
        f"потом {plan_price('monthly')} ₽ в месяц, отключается в один клик. "
        f"Пока отвечу как обычный Фреди."
    )


def is_lock_text(text: Optional[str]) -> bool:
    return bool(text) and text.startswith(LOCK_PREFIX)


def _tech_fail_texts() -> List[str]:
    """Заглушки «технический сбой» — не ответы, в счёт не идут.

    13.09.2026 06:06 МСК: человек с аккаунтом получил в коуче две заглушки
    и один живой ответ — и на четвёртом сообщении замок «три ответа вы уже
    получили». Два из трёх «ответов» были сбоем DeepSeek."""
    try:
        from services.ai_service import _TECH_FAILS
        return [t.strip() for t in _TECH_FAILS]
    except Exception:
        return []


async def free_answers_used(db, user_id: int, modes: Iterable[str] = LOCK_MODES) -> int:
    """Сколько настоящих ответов коуча/тренера человек уже получил."""
    try:
        row = await db.fetchrow(
            """SELECT COUNT(*)::int AS n
                 FROM fredi_messages
                WHERE user_id = $1
                  AND role = 'assistant'
                  AND COALESCE(metadata->>'mode', '') = ANY($2::text[])
                  AND content NOT LIKE $3
                  AND NOT (btrim(content) = ANY($4::text[]))""",
            int(user_id), list(modes), LOCK_PREFIX + "%", _tech_fail_texts(),
        )
        return int(row["n"] if row else 0)
    except Exception as e:
        # При сбое базы не запирать человека: лучше лишний ответ, чем
        # ложный замок.
        logger.warning(f"[premium_gate] count failed for {user_id}: {e}")
        return 0


def should_lock(mode: str, is_premium: bool, used: int) -> bool:
    return (mode in LOCK_MODES) and (not is_premium) and (used >= FREE_ANSWERS)


class LockedMode:
    """Подмена режима: строка замка, а дальше — ответ обычного Фреди.

    Повторяет интерфейс BaseMode ровно настолько, насколько его трогают
    обработчики /api/chat, /api/chat/stream и голосовые пути.

    До 18.09.2026 замок был единственным содержимым ответа: модель не
    звалась, человек получал текст про подписку — и на любой следующий
    вопрос тот же текст снова. В выгрузке 11–17.09 это 12 ответов у
    четырёх человек, все с аккаунтом, то есть самые готовые платить.
    Елена, 52: «ничего не поняла... что мне делать» — и замок в третий
    раз. Продажа, которая глотает вопрос, ничего не продаёт.

    Теперь fallback — инстанс BasicMode того же человека: замок идёт
    первой строкой, потом настоящий ответ на его вопрос. Вся реплика
    начинается с LOCK_PREFIX, поэтому в счёт бесплатных ответов коуча
    она по-прежнему не попадает (free_answers_used исключает её по
    префиксу). Без fallback (голосовые пути, где инстанса под рукой
    нет) поведение прежнее — только строка.
    """

    def __init__(self, mode: str, fallback=None):
        self.name = mode
        self.locked_mode = mode
        self.text = lock_text(mode)
        self.fallback = fallback
        self.last_tools_used: List[str] = []
        self.history: List[Dict[str, Any]] = []
        self.test_offered = False

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        yield self.text
        if self.fallback is None:
            return
        yield "\n\n"
        try:
            async for chunk in self.fallback.process_question_streaming(question):
                if chunk:
                    yield chunk
        except Exception as e:
            logger.warning(f"[premium_gate] fallback stream failed: {e}")

    async def process_question_full(self, question: str) -> str:
        parts = []
        async for chunk in self.process_question_streaming(question):
            parts.append(chunk)
        return "".join(parts)

    async def process_question(self, question: str) -> str:
        return self.text

    def save_to_history(self, question: str, response: str) -> None:
        return None

    def save_method_state(self) -> None:
        return None
