"""
web_access.py — доступ Фреди к свежей информации из интернета (Tavily).

По умолчанию Фреди отвечает из знаний модели (обрезка ~ май 2025, без сети).
Здесь — ПРЕДВЫБОРКА ПО НАМЕРЕНИЮ: если вопрос требует АКТУАЛЬНЫХ данных
(погода, курс валют, новости, «загугли…»), ходим в Tavily и кладём результат
в системный промпт. На обычные разговорные/терапевтические сообщения НЕ
реагируем — чтобы не тормозить ответ и не жечь запросы впустую.

Ключ — переменная окружения TAVILY_API_KEY. Нет ключа → модуль тихо no-op.
"""

from __future__ import annotations

import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

TAVILY_URL = "https://api.tavily.com/search"
TAVILY_TIMEOUT_S = 8.0

# Явная просьба поискать в сети.
_WEB_EXPLICIT_RE = re.compile(
    r"(загугл|погугл|гугл(ани|ну|ни)?|"
    r"поищи\s+в\s+(интернет\w*|сет\w+|гугл\w*)|"
    r"найди\s+в\s+(интернет\w*|сет\w+)|"
    r"посмотри\s+в\s+(интернет\w*|сет\w+)|"
    r"поиск\w*\s+в\s+(интернет\w*|сет\w+)|"
    r"\bв\s+интернете\b|\bв\s+сети\b)",
    re.IGNORECASE,
)

# Запросы на свежие данные. Формулировки КОНКРЕТНЫЕ, чтобы не путать с
# терапией: «курс лечения» ≠ «курс доллара», «мне сейчас плохо» ≠ «погода».
_WEB_FRESH_RE = re.compile(
    r"(погод\w*|прогноз\w*\s+погод\w*|"
    r"курс\w*\s+(доллар\w*|евро|валют\w*|рубл\w*|юан\w*|биткоин\w*|обмен\w*)|"
    r"(доллар\w*|евро|биткоин\w*)\s+(сегодня|сейчас|курс\w*)|"
    r"сколько\s+стоит|цена\s+на\b|котировк\w*|\bбиржа\b|"
    r"\bновост\w+|что\s+(происходит|случилось|нового)\s+в\s+мире|"
    r"последние\s+событ\w*|"
    r"какое\s+сегодня\s+число|какой\s+сейчас\s+год|который\s+час|сколько\s+времени)",
    re.IGNORECASE,
)


def is_available() -> bool:
    return bool((os.environ.get("TAVILY_API_KEY") or "").strip())


def needs_fresh_info(text: str) -> bool:
    """True, если вопрос требует актуальных данных из сети."""
    if not text:
        return False
    return bool(_WEB_EXPLICIT_RE.search(text) or _WEB_FRESH_RE.search(text))


async def tavily_search(query: str, max_results: int = 4) -> dict:
    """Запрос в Tavily. Возвращает распарсенный JSON или {} при ошибке/без ключа."""
    key = (os.environ.get("TAVILY_API_KEY") or "").strip()
    if not key:
        return {}
    payload = {
        # Классический способ (ключ в теле) + заголовок Bearer — на случай
        # разных версий API Tavily.
        "api_key": key,
        "query": query[:400],
        "max_results": max_results,
        "search_depth": "basic",
        "include_answer": True,
        "topic": "general",
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
    try:
        async with httpx.AsyncClient(timeout=TAVILY_TIMEOUT_S) as client:
            r = await client.post(TAVILY_URL, json=payload, headers=headers)
        if r.status_code != 200:
            logger.warning(f"Tavily HTTP {r.status_code}: {r.text[:200]}")
            return {}
        return r.json() or {}
    except Exception as e:
        logger.warning(f"Tavily error: {e}")
        return {}


def _format_web_block(data: dict) -> str:
    if not data:
        return ""
    answer = (data.get("answer") or "").strip()
    results = data.get("results") or []
    if not answer and not results:
        return ""
    lines = ["=== СВЕЖИЕ ДАННЫЕ ИЗ ИНТЕРНЕТА ==="]
    lines.append(
        "(Актуальная информация по запросу пользователя — получена только что "
        "через веб-поиск. У тебя ЕСТЬ доступ к этим данным. Отвечай по ним "
        "спокойно и по делу, кратко. НЕ говори «у меня нет доступа к сети» и "
        "не ссылайся на дату обрезки знаний. Ссылки вслух не зачитывай — "
        "используй суть. Если данные не отвечают на вопрос — так и скажи.)"
    )
    if answer:
        lines.append(f"Сводка: {answer[:600]}")
    for res in results[:4]:
        title = (res.get("title") or "").strip()
        content = (res.get("content") or "").strip()
        if content:
            lines.append(f"— {title}: {content[:300]}")
    lines.append("=== КОНЕЦ СВЕЖИХ ДАННЫХ ===")
    return "\n".join(lines) + "\n\n"


async def fetch_web_context(question: str) -> str:
    """Главная точка входа: если вопрос требует свежих данных и есть ключ —
    ищем в Tavily и возвращаем готовый блок для подмешивания в промпт.
    Иначе — пустая строка. Тихий: любые ошибки → ''.
    """
    try:
        if not is_available() or not needs_fresh_info(question):
            return ""
        data = await tavily_search(question)
        block = _format_web_block(data)
        if block:
            logger.info(f"🌐 web_access: Tavily контекст добавлен для «{question[:60]}»")
        else:
            logger.info(f"🌐 web_access: Tavily без результатов для «{question[:60]}»")
        return block
    except Exception as e:
        logger.warning(f"fetch_web_context error: {e}")
        return ""
