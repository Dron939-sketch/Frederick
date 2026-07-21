"""
session_memory.py — Кросс-сессионная память Фреди.

Решает проблему: каждая новая сессия Фреди начинает «с нуля», даже если
неделю назад клиент уже рассказывал ту же тему. Нет преемственности —
нет ощущения «он меня помнит».

Архитектура:

  1) Таблица fredi_session_summaries — DeepSeek-сводки прошлых сессий.
     По одной строке на «сессию» (определяется по gap между сообщениями
     > SESSION_GAP_HOURS).

  2) Backgroound-задача `maybe_summarize_previous_session(user_id)`:
     - находит messages с last_summary.ended_at до настоящего
     - если последнее сообщение старше SESSION_GAP_HOURS — это закрытая сессия
     - генерирует сводку через DeepSeek
     - пишет в БД

  3) Загрузчик `load_memory_block(user_id, limit=3)`:
     - берёт топ-N сводок по ended_at DESC
     - форматирует в plain text блок «ПАМЯТЬ»
     - готов к подмешиванию в system_prompt

  4) Моды (psychologist, coach) в начале процессинга:
     - вызывают load_memory_block → префикс к system_prompt
     - запускают maybe_summarize_previous_session как fire-and-forget task
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# Глобальная ссылка на пул БД — устанавливается register_session_memory().
_db_ref = None

# Сессия считается закрытой, если с последнего сообщения прошло столько часов.
SESSION_GAP_HOURS = 4

# Минимальное число обменов в сессии, чтобы её суммаризировать (иначе шум).
MIN_MESSAGES_FOR_SUMMARY = 4

# Сколько последних сводок подмешивать в промпт (баланс контекст/токены).
DEFAULT_MEMORY_LIMIT = 3

# DeepSeek
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_TIMEOUT_S = 60.0


SUMMARY_SYSTEM_PROMPT = (
    "Ты — внутренний аналитик Фреди. Твоя задача — превратить транскрипт ОДНОЙ "
    "сессии (пользователь + Фреди) в структурированную сводку, которую сам Фреди "
    "будет читать перед следующей встречей с этим человеком.\n\n"
    "Сводка должна позволять Фреди:\n"
    "- сразу узнать клиента и его контекст («ага, это та, что про развод»)\n"
    "- сослаться на что-то из прошлой беседы («помнишь, мы говорили про...»)\n"
    "- продолжить с того места, где остановились, не заставляя пересказывать\n\n"
    "ВАЖНО:\n"
    "- Без терапевтического жаргона. Простыми словами, как заметки для себя.\n"
    "- Факты — точные, эмоции — без приукрашивания.\n"
    "- Если в сессии прозвучали конкретные имена, числа, даты, события —\n"
    "  обязательно сохрани их (например: «жена Аня», «двое детей 5 и 8 лет»,\n"
    "  «развод с октября 2024», «работает в IT, маркетинг»).\n\n"
    "Возвращай СТРОГО JSON по схеме:\n"
    "{\n"
    "  \"summary\": \"3–5 предложений простым языком: о чём была сессия и где остановились.\",\n"
    "  \"key_facts\": {\n"
    "    \"persons\": [\"имена и роли упомянутых людей\"],\n"
    "    \"events\": [\"конкретные события / даты / факты\"],\n"
    "    \"themes\": [\"главные темы беседы\"],\n"
    "    \"emotions\": [\"эмоциональные состояния клиента\"],\n"
    "    \"hypotheses\": [\"гипотезы Фреди о причинах / паттернах\"],\n"
    "    \"actions_or_tools\": [\"что было предложено / что клиент решил делать\"]\n"
    "  },\n"
    "  \"continuity_hooks\": [\n"
    "    \"короткие фразы-зацепки для начала следующей сессии — то, на чём естественно продолжить\"\n"
    "  ],\n"
    "  \"client_state_at_end\": \"как клиент уходил: 'облегчение' / 'злость не проработана' / 'застрял на X' и т.п.\"\n"
    "}\n"
    "Никакого markdown, никаких префиксов вроде ```json — только сам JSON."
)


# ============================================================
# DB MIGRATION
# ============================================================


def register_session_memory(app, db):
    """Регистрирует init-функцию таблицы. Вызывается из chain в analytics_routes.

    `app` параметр сохранён для согласованности интерфейса (другие register_X
    тоже принимают app, хотя сюда HTTP-роуты вешаются отдельно ниже).
    """
    global _db_ref
    _db_ref = db

    async def init_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_session_summaries (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL
                        REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                    mode TEXT,
                    method_code TEXT,
                    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    message_count INT NOT NULL DEFAULT 0,
                    summary TEXT,
                    key_facts JSONB,
                    continuity_hooks JSONB,
                    client_state_at_end TEXT,
                    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_session_summaries_user_ended "
                "ON fredi_session_summaries(user_id, ended_at DESC)"
            )
            # Партиционирование/чистку оставим на потом — на ранней стадии хватит.
        logger.info("Session-memory table ready")

    return init_table


# ============================================================
# DEEPSEEK SUMMARIZER
# ============================================================


def _format_messages_for_summary(messages: List[Dict[str, Any]], char_budget: int = 8000) -> str:
    out: List[str] = []
    used = 0
    for m in messages:
        role = (m.get("role") or "").strip()
        content = str(m.get("content") or "").strip()
        if not content or role not in ("user", "assistant"):
            continue
        prefix = "ПОЛЬЗОВАТЕЛЬ" if role == "user" else "ФРЕДИ"
        chunk = f"{prefix}: {content[:600]}"
        if used + len(chunk) > char_budget:
            out.append("…[обрезано]")
            break
        out.append(chunk)
        used += len(chunk) + 1
    return "\n\n".join(out) or "(нет сообщений)"


async def _call_deepseek(messages_block: str) -> Dict[str, Any]:
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY не задан")
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": messages_block},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=DEEPSEEK_TIMEOUT_S) as client:
            r = await client.post(
                DEEPSEEK_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as e:
        raise RuntimeError(f"DeepSeek network error: {e}")
    if r.status_code != 200:
        raise RuntimeError(f"DeepSeek HTTP {r.status_code}: {r.text[:300]}")
    body = r.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"DeepSeek unexpected shape: {str(body)[:300]}")
    try:
        import asyncio as _aio
        from services.api_usage import log_llm_usage, extract_deepseek_tokens
        tk = extract_deepseek_tokens(body)
        _aio.create_task(log_llm_usage(
            provider="deepseek", model="deepseek-chat",
            tokens_in=tk["tokens_in"], tokens_out=tk["tokens_out"],
            feature="session_memory.compact",
        ))
    except Exception:
        pass
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"DeepSeek non-JSON: {e}; text={text[:200]}")


# ============================================================
# CORE: detect & summarize previous session
# ============================================================


async def _fetch_messages_since(conn, user_id: int, since_ts: Optional[datetime]):
    if since_ts is None:
        return await conn.fetch(
            "SELECT id, role, content, metadata, created_at FROM fredi_messages "
            "WHERE user_id = $1 ORDER BY id ASC",
            int(user_id),
        )
    return await conn.fetch(
        "SELECT id, role, content, metadata, created_at FROM fredi_messages "
        "WHERE user_id = $1 AND created_at > $2 ORDER BY id ASC",
        int(user_id), since_ts,
    )


async def maybe_summarize_previous_session(user_id: int) -> Optional[int]:
    """Если есть закрытая сессия после последней сводки — суммаризировать.

    Возвращает id новой сводки или None если нечего делать.
    Не кидает наружу — все ошибки логируются.
    """
    if _db_ref is None:
        return None
    try:
        async with _db_ref.get_connection() as conn:
            last = await conn.fetchrow(
                "SELECT ended_at FROM fredi_session_summaries "
                "WHERE user_id = $1 ORDER BY ended_at DESC LIMIT 1",
                int(user_id),
            )
            since_ts = last["ended_at"] if last else None
            rows = await _fetch_messages_since(conn, user_id, since_ts)

        if len(rows) < MIN_MESSAGES_FOR_SUMMARY:
            return None

        # Группируем по сессиям: gap > SESSION_GAP_HOURS = новая сессия.
        # Суммаризируем только ПЕРВУЮ закрытую сессию (если их несколько,
        # следующий вызов суммаризирует следующую — пошагово).
        session_msgs: List[Dict[str, Any]] = []
        prev_at: Optional[datetime] = None
        cutoff = datetime.now(timezone.utc).timestamp() - SESSION_GAP_HOURS * 3600

        for r in rows:
            cur_at = r["created_at"]
            if prev_at is not None:
                gap_h = (cur_at - prev_at).total_seconds() / 3600.0
                if gap_h > SESSION_GAP_HOURS:
                    # session_msgs — закрытая, можно суммаризировать
                    break
            session_msgs.append(dict(r))
            prev_at = cur_at

        # Если последнее сообщение в session_msgs свежее cutoff — сессия открыта,
        # ждём пока юзер «отойдёт».
        if not session_msgs:
            return None
        last_msg_ts = session_msgs[-1]["created_at"]
        if last_msg_ts.timestamp() > cutoff:
            return None
        if len(session_msgs) < MIN_MESSAGES_FOR_SUMMARY:
            return None

        # Зовём DeepSeek
        block = _format_messages_for_summary(session_msgs)
        try:
            result = await _call_deepseek(block)
        except RuntimeError as e:
            logger.warning(f"summarize: deepseek failed for user_id={user_id}: {e}")
            return None

        summary_text = (result.get("summary") or "").strip()
        if not summary_text:
            return None

        # Определяем mode/method из metadata последнего assistant-сообщения сессии.
        mode_str = ""
        method_code = ""
        for r in reversed(session_msgs):
            if (r.get("role") or "") != "assistant":
                continue
            meta = r.get("metadata")
            if isinstance(meta, str):
                try: meta = json.loads(meta)
                except Exception: meta = {}
            if isinstance(meta, dict):
                mode_str = str(meta.get("mode") or "")
                method_code = str(meta.get("method_code") or meta.get("method") or "")
                break

        async with _db_ref.get_connection() as conn:
            row = await conn.fetchrow(
                "INSERT INTO fredi_session_summaries "
                "(user_id, mode, method_code, started_at, ended_at, message_count, "
                " summary, key_facts, continuity_hooks, client_state_at_end) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10) "
                "RETURNING id",
                int(user_id), mode_str, method_code,
                session_msgs[0]["created_at"], session_msgs[-1]["created_at"],
                len(session_msgs),
                summary_text,
                json.dumps(result.get("key_facts") or {}, ensure_ascii=False),
                json.dumps(result.get("continuity_hooks") or [], ensure_ascii=False),
                str(result.get("client_state_at_end") or "")[:300],
            )
        new_id = row["id"] if row else None
        logger.info(f"session summary saved for user_id={user_id}, id={new_id}, msgs={len(session_msgs)}")
        return new_id
    except Exception as e:
        logger.warning(f"maybe_summarize_previous_session({user_id}) error: {e}")
        return None


# ============================================================
# LOAD MEMORY FOR PROMPT
# ============================================================


def _format_memory_text(rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return ""
    lines: List[str] = []
    lines.append("=== ПАМЯТЬ О ПРЕДЫДУЩИХ СЕССИЯХ ===")
    lines.append(
        "(Это твои внутренние заметки для фона. Держи их в уме, но НЕ навязывай и НЕ "
        "притягивай к каждому ответу. Отвечай прежде всего на то, о чём человек "
        "спрашивает СЕЙЧАС. Ссылайся на прошлое ТОЛЬКО если это прямо относится к "
        "текущему вопросу и уместно. Если человек задаёт обычный или лёгкий вопрос "
        "(посчитать, узнать факт, время) — просто ответь на него; НЕ начинай с "
        "«помнишь, в прошлый раз ты...», НЕ напоминай человеку про его прошлое "
        "состояние и НЕ притягивай прошлые тяжёлые или кризисные темы без его "
        "инициативы. Никогда не цитируй эти заметки дословно и не выдавай как «отчёт».)"
    )
    for r in rows:
        ended = r.get("ended_at")
        ended_s = ended.strftime("%d %b %Y") if ended else ""
        mode = r.get("mode") or ""
        method = r.get("method_code") or ""
        tag_parts = [s for s in [ended_s, mode, method] if s]
        tag = " · ".join(tag_parts)
        lines.append(f"\n— {tag}")
        if r.get("summary"):
            lines.append(f"  Суть: {r['summary']}")
        kf = r.get("key_facts")
        if isinstance(kf, str):
            try: kf = json.loads(kf)
            except Exception: kf = None
        if isinstance(kf, dict):
            for label, key in (("Люди", "persons"), ("События", "events"),
                                ("Темы", "themes"), ("Эмоции", "emotions"),
                                ("Гипотезы", "hypotheses"),
                                ("Шаги", "actions_or_tools")):
                vals = kf.get(key) or []
                if vals:
                    lines.append(f"  {label}: {', '.join(str(v)[:100] for v in vals[:5])}")
        hooks = r.get("continuity_hooks")
        if isinstance(hooks, str):
            try: hooks = json.loads(hooks)
            except Exception: hooks = None
        if isinstance(hooks, list) and hooks:
            lines.append("  Зацепки: " + " | ".join(str(h)[:120] for h in hooks[:3]))
        if r.get("client_state_at_end"):
            lines.append(f"  Уходил с состоянием: {r['client_state_at_end']}")
    lines.append("\n=== КОНЕЦ ПАМЯТИ ===\n")
    return "\n".join(lines)


async def load_memory_block(user_id: int, limit: int = DEFAULT_MEMORY_LIMIT) -> str:
    """Возвращает форматированный блок памяти для подмешивания в system_prompt.

    Тихий: при ошибках возвращает пустую строку. Не блокирует основной поток.
    """
    if _db_ref is None or not user_id:
        return ""
    try:
        async with _db_ref.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT mode, method_code, started_at, ended_at, message_count, "
                "       summary, key_facts, continuity_hooks, client_state_at_end "
                "FROM fredi_session_summaries "
                "WHERE user_id = $1 ORDER BY ended_at DESC LIMIT $2",
                int(user_id), int(limit),
            )
        return _format_memory_text([dict(r) for r in rows])
    except Exception as e:
        logger.warning(f"load_memory_block({user_id}) error: {e}")
        return ""


def schedule_summarize_in_background(user_id: int) -> None:
    """Запускает суммаризацию в background. Fire-and-forget."""
    if _db_ref is None or not user_id:
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(maybe_summarize_previous_session(int(user_id)))
    except RuntimeError:
        # Нет running loop — значит мы не в async-контексте; пропускаем.
        pass


# ============================================================
# IN-SESSION ROLLING MEMO (скользящий конспект текущего разговора)
# ============================================================
#
# Проблема: в промпт психолога уходят только последние ~10 сообщений
# (history[-10]). Когда разговор длиннее — ранние реплики выпадают из окна,
# и Фреди теряет нить (о чём вообще была беседа, какие факты уже назвали).
# Кросс-сессионная память (выше) закрывает ПРОШЛЫЕ сессии, но не текущую.
#
# Решение: Фреди сам ведёт короткий «конспект» ТЕКУЩЕГО разговора. Он копится
# не в истории (её мы как раз режем), а отдельным сжатым блоком, который
# подмешивается в system_prompt. Обновляется в фоне АДАПТИВНО — когда с
# последнего обновления накопилось достаточно новых реплик ИЛИ достаточно
# текста (болтливый диалог триггерит раньше). Хранится в
# context.psychologist_state.session_memo (переживает реконнекты).
# Пока включён только для режима «Психолог».

MEMO_MIN_NEW_MESSAGES = 6      # обновить, если ≥ стольких новых сообщений…
MEMO_NEW_CHARS_BUDGET = 700    # …ИЛИ если новых символов набралось столько
MEMO_MAX_CHARS = 900           # предохранитель на длину самого конспекта
MEMO_RECENT_WINDOW = 40        # сколько последних сообщений максимум складываем за раз

MEMO_SYSTEM_PROMPT = (
    "Ты — внутренний конспектист Фреди. Тебе дают ТЕКУЩИЙ конспект разговора "
    "(может быть пустым) и НОВЫЕ реплики этого же разговора. Верни ОБНОВЛЁННЫЙ "
    "короткий конспект — чтобы Фреди не терял нить, когда ранние реплики "
    "уходят из окна истории.\n\n"
    "Требования:\n"
    "- 3–6 коротких строк, простым языком, как заметки для себя.\n"
    "- Сохраняй конкретику: имена, числа, даты, события, решения.\n"
    "- Отрази: о чём разговор, что уже выяснили, гипотезы, на чём остановились.\n"
    "- ОБНОВЛЯЙ, а не накапливай: если старое перестало быть важным — выкидывай. "
    "Конспект должен оставаться коротким.\n"
    "- Верни только сам конспект: без префиксов, без markdown, без JSON."
)


async def _call_deepseek_text(
    system_prompt: str, user_prompt: str,
    temperature: float = 0.3, max_tokens: int = 400,
    feature: str = "session_memo.rolling",
) -> str:
    """Как _call_deepseek, но обычный текст (не JSON) и произвольный system."""
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY не задан")
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        async with httpx.AsyncClient(timeout=DEEPSEEK_TIMEOUT_S) as client:
            r = await client.post(
                DEEPSEEK_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as e:
        raise RuntimeError(f"DeepSeek network error: {e}")
    if r.status_code != 200:
        raise RuntimeError(f"DeepSeek HTTP {r.status_code}: {r.text[:300]}")
    body = r.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"DeepSeek unexpected shape: {str(body)[:300]}")
    try:
        import asyncio as _aio
        from services.api_usage import log_llm_usage, extract_deepseek_tokens
        tk = extract_deepseek_tokens(body)
        _aio.create_task(log_llm_usage(
            provider="deepseek", model="deepseek-chat",
            tokens_in=tk["tokens_in"], tokens_out=tk["tokens_out"],
            feature=feature,
        ))
    except Exception:
        pass
    return (content or "").strip()


async def _read_psychologist_state(user_id) -> Dict[str, Any]:
    """Свежий psychologist_state прямо из БД (в обход кэша context_repo)."""
    if _db_ref is None:
        return {}
    try:
        async with _db_ref.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT psychologist_state FROM fredi_user_contexts WHERE user_id::text = $1",
                str(user_id),
            )
        if not row:
            return {}
        st = row["psychologist_state"]
        if isinstance(st, str):
            try:
                st = json.loads(st)
            except Exception:
                st = {}
        return st if isinstance(st, dict) else {}
    except Exception as e:
        logger.debug(f"_read_psychologist_state({user_id}) error: {e}")
        return {}


def _format_session_memo_block(memo_text: str) -> str:
    memo_text = (memo_text or "").strip()
    if not memo_text:
        return ""
    return (
        "=== КОНСПЕКТ ТЕКУЩЕГО РАЗГОВОРА ===\n"
        "(Твои рабочие заметки по этой беседе — чтобы держать нить, даже когда "
        "ранние реплики ушли из окна. Держи в уме, но НЕ зачитывай вслух и НЕ "
        "притягивай без нужды. Отвечай прежде всего на то, что человек "
        "спрашивает СЕЙЧАС.)\n"
        f"{memo_text[:MEMO_MAX_CHARS]}\n"
        "=== КОНЕЦ КОНСПЕКТА ===\n\n"
    )


async def load_session_memo_block(user_id) -> str:
    """Блок конспекта текущего разговора для подмешивания в system_prompt.

    Тихий: при любой ошибке — пустая строка.
    """
    if _db_ref is None or not user_id:
        return ""
    try:
        st = await _read_psychologist_state(user_id)
        memo = (st or {}).get("session_memo") or {}
        if not isinstance(memo, dict):
            return ""
        return _format_session_memo_block(memo.get("text", ""))
    except Exception as e:
        logger.debug(f"load_session_memo_block({user_id}) error: {e}")
        return ""


async def _refresh_session_memo(user_id) -> None:
    """Фоновое обновление конспекта: адаптивный гейт → DeepSeek → запись в state.

    Не кидает наружу. Запись через context_repo (чистит кэш) с сохранением
    method-полей psychologist_state.
    """
    if _db_ref is None or not user_id:
        return
    try:
        st = await _read_psychologist_state(user_id)
        memo = (st or {}).get("session_memo") or {}
        if not isinstance(memo, dict):
            memo = {}
        upto = int(memo.get("upto_msg_id") or 0)
        old_text = (memo.get("text") or "").strip()

        # Берём последние сообщения, из них — только новые (id > upto).
        # DESC+LIMIT ограничивает работу и держит фокус на свежем хвосте.
        async with _db_ref.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT id, role, content FROM fredi_messages "
                "WHERE user_id::text = $1 AND id > $2 "
                "ORDER BY id DESC LIMIT $3",
                str(user_id), upto, MEMO_RECENT_WINDOW,
            )
        new_rows = [
            {"role": r["role"], "content": r["content"], "id": r["id"]}
            for r in reversed(rows)
            if (r["role"] in ("user", "assistant")) and (r["content"] or "").strip()
        ]
        if not new_rows:
            return

        new_chars = sum(len(r["content"]) for r in new_rows)
        # Адаптивный гейт по объёму: хватило сообщений ИЛИ текста.
        if len(new_rows) < MEMO_MIN_NEW_MESSAGES and new_chars < MEMO_NEW_CHARS_BUDGET:
            return

        new_block = _format_messages_for_summary(new_rows, char_budget=6000)
        user_prompt = (
            f"ТЕКУЩИЙ КОНСПЕКТ:\n{old_text or '(пусто)'}\n\n"
            f"НОВЫЕ РЕПЛИКИ:\n{new_block}\n\n"
            "Верни обновлённый конспект."
        )
        try:
            new_text = await _call_deepseek_text(MEMO_SYSTEM_PROMPT, user_prompt)
        except RuntimeError as e:
            logger.debug(f"memo deepseek failed for {user_id}: {e}")
            return
        new_text = (new_text or "").strip()
        if not new_text:
            return
        max_id = max(int(r["id"]) for r in new_rows)

        # Запись обратно через context_repo (сбрасывает кэш контекста),
        # сохраняя method-поля. Ленивый import main — разрыв цикла: main тянет
        # session_memory через analytics_routes, поэтому импортим в рантайме.
        import main as _main
        ctx = await _main.context_repo.get(user_id) or {}
        psy = ctx.get("psychologist_state") or {}
        if not isinstance(psy, dict):
            psy = {}
        psy["session_memo"] = {
            "text": new_text[:MEMO_MAX_CHARS],
            "upto_msg_id": max_id,
            "covered": int(memo.get("covered") or 0) + len(new_rows),
        }
        ctx["psychologist_state"] = psy
        await _main.context_repo.save(user_id, ctx)
        logger.info(
            f"🧵 session_memo refreshed user={user_id} +{len(new_rows)}msg "
            f"chars={new_chars} upto={max_id} len={len(new_text)}"
        )
    except Exception as e:
        logger.warning(f"_refresh_session_memo({user_id}) error: {e}")


def schedule_session_memo_refresh(user_id) -> None:
    """Fire-and-forget обновление конспекта текущего разговора."""
    if _db_ref is None or not user_id:
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_refresh_session_memo(user_id))
    except RuntimeError:
        pass


# ============================================================
# ADMIN ROUTES
# ============================================================


def register_session_memory_routes(app, db):
    """Эндпоинты управления памятью под X-Admin-Token."""
    from fastapi import HTTPException, Header
    # Раньше тут был `from typing import Optional as _Opt` — алиас в локальной
    # области функции, который Pydantic v2.5 не видит при разрешении
    # аннотаций (eval_type ищет в module globals). Берём уже импортированный
    # на модульном уровне Optional.

    def _check_admin(token):
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected:
            raise HTTPException(status_code=503, detail={"error": "admin_disabled"})
        if not token or token != expected:
            raise HTTPException(status_code=401, detail={"error": "unauthorized"})

    @app.post("/api/admin/fredi/summarize-session/{user_id}")
    async def summarize_session_endpoint(
        user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Ручной триггер суммаризации последней закрытой сессии юзера."""
        _check_admin(x_admin_token)
        new_id = await maybe_summarize_previous_session(int(user_id))
        if new_id is None:
            return {"ok": False, "reason": "нечего суммаризировать (либо сессия открыта, либо короткая)"}
        return {"ok": True, "summary_id": new_id}

    @app.get("/api/admin/fredi/sessions/{user_id}")
    async def list_sessions(
        user_id: int,
        limit: int = 20,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Список сводок сессий юзера."""
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT id, mode, method_code, started_at, ended_at, message_count, "
                "       summary, key_facts, continuity_hooks, client_state_at_end, "
                "       generated_at "
                "FROM fredi_session_summaries WHERE user_id = $1 "
                "ORDER BY ended_at DESC LIMIT $2",
                int(user_id), max(1, min(int(limit), 100)),
            )

        def _jb(v):
            if v is None: return None
            if isinstance(v, str):
                try: return json.loads(v)
                except Exception: return v
            return v

        return {
            "user_id": int(user_id),
            "items": [{
                "id": r["id"],
                "mode": r["mode"],
                "method_code": r["method_code"],
                "started_at": r["started_at"].isoformat() if r["started_at"] else None,
                "ended_at": r["ended_at"].isoformat() if r["ended_at"] else None,
                "message_count": r["message_count"],
                "summary": r["summary"],
                "key_facts": _jb(r["key_facts"]) or {},
                "continuity_hooks": _jb(r["continuity_hooks"]) or [],
                "client_state_at_end": r["client_state_at_end"],
                "generated_at": r["generated_at"].isoformat() if r["generated_at"] else None,
            } for r in rows],
        }
