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
    title = _MODE_TITLES.get(mode, mode.capitalize())
    return (
        f"{LOCK_PREFIX}{title}» доступен только с подпиской Premium. "
        f"Три ответа в этом режиме вы уже получили — дальше он работает по "
        f"подписке: первая неделя 290 ₽, потом 990 ₽ в месяц, отключается в один "
        f"клик в разделе «Подписка». Без подписки со мной можно продолжать в "
        f"обычном режиме — переключите роль в меню, разговор сохранится."
    )


def is_lock_text(text: Optional[str]) -> bool:
    return bool(text) and text.startswith(LOCK_PREFIX)


async def free_answers_used(db, user_id: int, modes: Iterable[str] = LOCK_MODES) -> int:
    """Сколько настоящих ответов коуча/тренера человек уже получил."""
    try:
        row = await db.fetchrow(
            """SELECT COUNT(*)::int AS n
                 FROM fredi_messages
                WHERE user_id = $1
                  AND role = 'assistant'
                  AND COALESCE(metadata->>'mode', '') = ANY($2::text[])
                  AND content NOT LIKE $3""",
            int(user_id), list(modes), LOCK_PREFIX + "%",
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
    """Подмена режима: отвечает текстом замка и не зовёт модель.

    Повторяет интерфейс BaseMode ровно настолько, насколько его трогают
    обработчики /api/chat, /api/chat/stream и голосовые пути.
    """

    def __init__(self, mode: str):
        self.name = mode
        self.locked_mode = mode
        self.text = lock_text(mode)
        self.last_tools_used: List[str] = []
        self.history: List[Dict[str, Any]] = []
        self.test_offered = False

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        yield self.text

    async def process_question_full(self, question: str) -> str:
        return self.text

    async def process_question(self, question: str) -> str:
        return self.text

    def save_to_history(self, question: str, response: str) -> None:
        return None

    def save_method_state(self) -> None:
        return None
