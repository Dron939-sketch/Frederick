#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kimi (Moonshot) — запасная модель Фреди.

DeepSeek остаётся основной: под него вылизаны промпты, кэш и аналитика.
Kimi включается вторым двигателем и отвечает там, где DeepSeek не дал ни
одного знака: кончился баланс, истёк ключ, потерян маршрут до CDN,
провайдер молчит или отдаёт 5xx.

API у Moonshot OpenAI-совместимый (/chat/completions), поэтому код почти
копирует вызов DeepSeek: другие только адрес, ключ и имя модели.

Два ограничения провайдера, проверенные живыми запросами 06.11.2026:
  * K3 — рассуждающая модель, temperature принимает только 1.0, иначе 400;
  * рассуждение съедает max_tokens до того, как появится видимый текст:
    при 120 токенах ответа нет вовсе (finish=length, content пуст), при 600
    приходит нормальная фраза. Поэтому бюджет всегда с запасом (см. _budget).

Без MOONSHOT_API_KEY сервис молча выключен: ask() возвращает None, а
поведение Фреди не меняется ровно никак.

Переменные окружения:
  MOONSHOT_API_KEY   ключ из кабинета Moonshot (без него сервис выключен)
  MOONSHOT_BASE_URL  адрес API, по умолчанию https://api.moonshot.ai/v1
  MOONSHOT_MODEL     имя модели, по умолчанию kimi-k3.1-pro-highspeed
  MOONSHOT_MODELS    через запятую: дополнительные модели на случай 404
"""

import asyncio
import logging
import os
import time
from typing import List, Optional, Tuple

import aiohttp

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.moonshot.ai/v1"
DEFAULT_MODEL = "kimi-k3.1-pro-highspeed"
# Проверено в аккаунте: kimi-k3, kimi-k3.1-pro, kimi-k3.1-pro-highspeed.
# Алиаса kimi-latest у провайдера нет (404), поэтому цепочка — из реальных имён.
MODEL_CHAIN = ("kimi-k3.1-pro-highspeed", "kimi-k3.1-pro", "kimi-k3")
DEFAULT_TIMEOUT = 120

# Запас бюджета под невидимое рассуждение K3.
MIN_OUT_TOKENS = 1500
MAX_OUT_TOKENS = 8000
_K3_PREFIX = "kimi-k3"

# Для статуса и логов: снаружи видно, сколько раз Kimi выручила и чем
# кончилась последняя попытка. Причина отказа DeepSeek живёт в
# ai_service.LAST_AI_FAIL, здесь — только состояние запасного двигателя.
STATE = {"calls": 0, "ok": 0, "fail": 0, "last_error": "", "ts": 0.0, "model": ""}


def api_key() -> str:
    return (os.environ.get("MOONSHOT_API_KEY") or "").strip()


def base_url() -> str:
    return (os.environ.get("MOONSHOT_BASE_URL") or DEFAULT_BASE_URL).strip().rstrip("/")


def model() -> str:
    return (os.environ.get("MOONSHOT_MODEL") or DEFAULT_MODEL).strip()


def model_chain() -> List[str]:
    """Модели в порядке попыток: выбранная, затем известные рабочие."""
    chain = [model()]
    for name in MODEL_CHAIN:
        if name not in chain:
            chain.append(name)
    extra = (os.environ.get("MOONSHOT_MODELS") or "").strip()
    if extra:
        for name in extra.split(","):
            name = name.strip()
            if name and name not in chain:
                chain.append(name)
    return chain


def is_enabled() -> bool:
    return bool(api_key())


def status() -> dict:
    return dict(STATE)


def _temperature(model_name: str, temperature: float) -> float:
    """K3 — рассуждающая: провайдер принимает только 1.0. Остальным — как просили."""
    if model_name.lower().startswith(_K3_PREFIX):
        return 1.0
    return temperature


def _budget(max_tokens: int) -> int:
    """Видимым ответ должен быть при любом запросе.

    K3 сначала думает невидимо и только потом пишет. При 120 токенах видимого
    текста не остаётся вообще, при 600 приходит фраза. Поэтому просим втрое
    больше и не меньше 1500.
    """
    try:
        req = int(max_tokens)
    except (TypeError, ValueError):
        req = 1000
    return max(MIN_OUT_TOKENS, min(req * 3, MAX_OUT_TOKENS))


def build_body(system_prompt: str, user_prompt: str,
               max_tokens: int = 1000, temperature: float = 0.7,
               json_mode: bool = False, model_name: Optional[str] = None) -> dict:
    """Тело запроса. Пустое system-сообщение не отправляем: пользы нет."""
    name = model_name or model()
    messages = []
    if (system_prompt or "").strip():
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})
    body = {
        "model": name,
        "messages": messages,
        "temperature": _temperature(name, temperature),
        "max_tokens": _budget(max_tokens),
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    return body


def extract_text(data) -> Tuple[str, str]:
    """Текст ответа и finish_reason."""
    if not isinstance(data, dict):
        return "", ""
    try:
        choice = (data.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content") or ""
        return text.strip(), (choice.get("finish_reason") or "")
    except Exception:
        return "", ""


async def _post(url: str, headers: dict, body: dict, timeout: float):
    """Один POST. Возвращает (status, данные): dict при 200, иначе текст тела.

    status 0 — таймаут, -1 — сетевой сбой. Так вызывающий код отличает
    «провайдер ответил ошибкой» от «до провайдера не достучались».
    """
    try:
        async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=timeout)) as session:
            async with session.post(url, headers=headers, json=body) as resp:
                if resp.status == 200:
                    try:
                        return 200, await resp.json()
                    except Exception:
                        return 200, (await resp.text())[:500]
                try:
                    return resp.status, (await resp.text())[:400]
                except Exception:
                    return resp.status, ""
    except asyncio.TimeoutError:
        return 0, "таймаут"
    except Exception as e:  # noqa: BLE001 — нужен любой сбой сети, не только aiohttp
        return -1, str(e)[:200]


def _snip(data) -> str:
    return (data if isinstance(data, str) else "")[:160]


async def _ask_one_model(url: str, headers: dict, system_prompt: str, user_prompt: str,
                         max_tokens: int, temperature: float, json_mode: bool,
                         timeout: float, model_name: str) -> Tuple[str, str, int]:
    """Попытки в рамках одной модели: JSON-режим, температура, бюджет, повторы."""
    body = build_body(system_prompt, user_prompt, max_tokens, temperature,
                      json_mode, model_name)
    status_code, data = await _post(url, headers, body, timeout)

    # Провайдер не знает response_format — повторяем без него, JSON разберёт
    # вызывающий код (он и так чистит ответы DeepSeek от обёрток).
    if status_code == 400 and json_mode:
        logger.warning("↩️ KIMI: 400 в JSON-режиме, повтор без response_format")
        body = build_body(system_prompt, user_prompt, max_tokens, temperature,
                          False, model_name)
        status_code, data = await _post(url, headers, body, timeout)

    # Не принял температуру — значит модель рассуждающая: повтор с 1.0.
    if status_code == 400 and "temperature" in _snip(data).lower():
        logger.warning("↩️ KIMI: температура не принята, повтор с temperature=1")
        body["temperature"] = 1.0
        status_code, data = await _post(url, headers, body, timeout)

    # Тишина, обрыв сети и 5xx — разовые сбои: один повтор через 1,5 с.
    if status_code in (0, -1) or status_code >= 500:
        logger.warning("↻ KIMI(%s): %s, повтор через 1,5 с", model_name, status_code)
        await asyncio.sleep(1.5)
        status_code, data = await _post(url, headers, body, timeout)

    if status_code != 200:
        return "", "Kimi(%s) ответила %s: %s" % (model_name, status_code, _snip(data)), status_code

    text, finish = extract_text(data)
    if text:
        return text, "", 200

    # Пусто при 200 — рассуждение съело бюджет. Один повтор с двойным бюджетом.
    bigger = min(int(body.get("max_tokens") or MIN_OUT_TOKENS) * 2, MAX_OUT_TOKENS * 2)
    logger.warning("↻ KIMI(%s): пустой ответ (finish=%s), повтор с max_tokens=%d",
                   model_name, finish or "?", bigger)
    body["max_tokens"] = bigger
    status_code, data = await _post(url, headers, body, timeout)
    if status_code == 200:
        text, finish = extract_text(data)
        if text:
            return text, "", 200
    return "", "Kimi(%s) вернула пустой ответ (finish=%s)" % (model_name, finish or "?"), status_code


async def ask(system_prompt: str, user_prompt: str,
              max_tokens: int = 1000, temperature: float = 0.7,
              json_mode: bool = False,
              timeout: Optional[float] = None) -> Optional[str]:
    """Один ответ Kimi или None.

    None — не исключение: вызывающий код (ai_service) сам решает, отдавать
    заглушку или пробовать дальше. Поэтому все сбои гасятся здесь и
    записываются в STATE["last_error"].
    """
    if not is_enabled():
        STATE["last_error"] = "нет ключа MOONSHOT_API_KEY"
        return None

    STATE["calls"] += 1
    STATE["ts"] = time.time()
    url = f"{base_url()}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key()}",
               "Content-Type": "application/json"}
    errors = []
    for model_name in model_chain():
        text, err, code = await _ask_one_model(
            url, headers, system_prompt, user_prompt, max_tokens, temperature,
            json_mode, timeout or DEFAULT_TIMEOUT, model_name)
        if text:
            STATE["ok"] += 1
            STATE["last_error"] = ""
            STATE["model"] = model_name
            logger.warning("🟣 KIMI_ANSWER: %d знаков, model=%s", len(text), model_name)
            return text
        errors.append(err)
        logger.warning("↩️ KIMI: %s", err)
        # Ключ и баланс от смены модели не лечатся — дальше пробовать незачем.
        if code in (401, 402):
            break

    STATE["fail"] += 1
    STATE["last_error"] = " | ".join(errors)[:300]
    logger.error("❌ KIMI: все модели не ответили: %s", STATE["last_error"])
    return None
