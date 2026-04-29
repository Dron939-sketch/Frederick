#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/api_usage.py
Учёт расходов на внешние платные API (DeepSeek, Anthropic, FishAudio, Deepgram, ...).

Каждый вызов внешнего API логируем в fredi_api_usage с input/output токенами
(или эквивалентом для аудио — секунды/символы) и computed-USD стоимостью.

Использование на стороне caller'а:
    from services.api_usage import log_llm_usage

    body = response.json()
    asyncio.create_task(log_llm_usage(
        provider="deepseek",
        model="deepseek-chat",
        tokens_in=body.get("usage", {}).get("prompt_tokens"),
        tokens_out=body.get("usage", {}).get("completion_tokens"),
        feature="vk_b2c_analyzer.profile",
        user_id=uid,
    ))

create_task — fire-and-forget, логирование не блокирует ответ юзеру.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ============================================================
# Прайс-лист (USD за 1M tokens / 1k chars / minute).
# Обновлять при изменении тарифов провайдеров.
# ============================================================
PRICING: Dict[str, Dict[str, Dict[str, float]]] = {
    "deepseek": {
        "deepseek-chat": {
            "input_per_mtok": 0.27,
            "output_per_mtok": 1.10,
        },
        "deepseek-reasoner": {
            "input_per_mtok": 0.55,
            "output_per_mtok": 2.19,
        },
    },
    "anthropic": {
        "claude-sonnet-4-20250514": {
            "input_per_mtok": 3.00,
            "output_per_mtok": 15.00,
        },
        "claude-3-5-sonnet-20241022": {
            "input_per_mtok": 3.00,
            "output_per_mtok": 15.00,
        },
        "claude-3-haiku-20240307": {
            "input_per_mtok": 0.25,
            "output_per_mtok": 1.25,
        },
        # Fallback для неизвестных Sonnet-моделей.
        "claude-sonnet-default": {
            "input_per_mtok": 3.00,
            "output_per_mtok": 15.00,
        },
    },
    "fishaudio": {
        # Текст→речь, цена за 1k символов.
        "default": {
            "per_kchar": 0.05,
        },
    },
    "deepgram": {
        # Речь→текст, цена за минуту аудио.
        "nova-2": {
            "per_minute": 0.0043,
        },
        "default": {
            "per_minute": 0.0043,
        },
    },
}


def _llm_cost_usd(provider: str, model: str, tokens_in: int, tokens_out: int) -> float:
    p = (PRICING.get(provider) or {}).get(model)
    if not p:
        # Fallback для неизвестной модели в провайдере.
        if provider == "anthropic":
            p = PRICING["anthropic"].get("claude-sonnet-default")
        else:
            return 0.0
    if not p:
        return 0.0
    cost = (
        (tokens_in or 0) / 1_000_000.0 * float(p.get("input_per_mtok") or 0.0)
        + (tokens_out or 0) / 1_000_000.0 * float(p.get("output_per_mtok") or 0.0)
    )
    return round(cost, 8)


def _tts_cost_usd(provider: str, model: str, chars: int) -> float:
    p = (PRICING.get(provider) or {}).get(model) or (PRICING.get(provider) or {}).get("default")
    if not p:
        return 0.0
    return round((chars or 0) / 1000.0 * float(p.get("per_kchar") or 0.0), 8)


def _stt_cost_usd(provider: str, model: str, seconds: float) -> float:
    p = (PRICING.get(provider) or {}).get(model) or (PRICING.get(provider) or {}).get("default")
    if not p:
        return 0.0
    return round((seconds or 0.0) / 60.0 * float(p.get("per_minute") or 0.0), 8)


_db_module = None


def set_db(db_module):
    """main.py при старте передаёт ссылку на db, чтобы не тащить циклический импорт."""
    global _db_module
    _db_module = db_module


async def _insert_usage(
    provider: str,
    model: str,
    feature: str,
    tokens_in: Optional[int],
    tokens_out: Optional[int],
    chars: Optional[int],
    seconds: Optional[float],
    cost_usd: float,
    user_id: Optional[int],
    status: str,
):
    if _db_module is None:
        return
    try:
        async with _db_module.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO fredi_api_usage
                    (provider, model, feature, tokens_in, tokens_out,
                     chars, seconds, cost_usd, user_id, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                provider, model[:128], (feature or "")[:128],
                int(tokens_in) if tokens_in is not None else None,
                int(tokens_out) if tokens_out is not None else None,
                int(chars) if chars is not None else None,
                float(seconds) if seconds is not None else None,
                float(cost_usd or 0.0),
                int(user_id) if user_id is not None else None,
                status[:32],
            )
    except Exception as e:
        # Лог не должен ломать основной поток.
        logger.warning(f"api_usage log failed ({provider}/{feature}): {e}")


async def log_llm_usage(
    provider: str,
    model: str,
    *,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    feature: str = "",
    user_id: Optional[int] = None,
    status: str = "ok",
):
    """Логирование LLM-вызова (DeepSeek / Anthropic)."""
    cost = _llm_cost_usd(provider, model, tokens_in or 0, tokens_out or 0)
    await _insert_usage(
        provider=provider, model=model, feature=feature,
        tokens_in=tokens_in, tokens_out=tokens_out,
        chars=None, seconds=None,
        cost_usd=cost, user_id=user_id, status=status,
    )


async def log_tts_usage(
    provider: str,
    model: str,
    *,
    chars: int,
    feature: str = "",
    user_id: Optional[int] = None,
    status: str = "ok",
):
    """Логирование TTS-вызова (Fish Audio / Yandex)."""
    cost = _tts_cost_usd(provider, model, chars)
    await _insert_usage(
        provider=provider, model=model, feature=feature,
        tokens_in=None, tokens_out=None,
        chars=chars, seconds=None,
        cost_usd=cost, user_id=user_id, status=status,
    )


async def log_stt_usage(
    provider: str,
    model: str,
    *,
    seconds: float,
    feature: str = "",
    user_id: Optional[int] = None,
    status: str = "ok",
):
    """Логирование STT-вызова (Deepgram)."""
    cost = _stt_cost_usd(provider, model, seconds)
    await _insert_usage(
        provider=provider, model=model, feature=feature,
        tokens_in=None, tokens_out=None,
        chars=None, seconds=seconds,
        cost_usd=cost, user_id=user_id, status=status,
    )


# Удобный sync-обёртывающий хелпер для DeepSeek-ответов:
# принимает body.json() и feature-tag, сам вытаскивает usage.
def extract_deepseek_tokens(body: Dict[str, Any]) -> Dict[str, Optional[int]]:
    usage = (body or {}).get("usage") or {}
    return {
        "tokens_in": usage.get("prompt_tokens"),
        "tokens_out": usage.get("completion_tokens"),
    }


def extract_anthropic_tokens(body: Dict[str, Any]) -> Dict[str, Optional[int]]:
    usage = (body or {}).get("usage") or {}
    return {
        "tokens_in": usage.get("input_tokens"),
        "tokens_out": usage.get("output_tokens"),
    }
