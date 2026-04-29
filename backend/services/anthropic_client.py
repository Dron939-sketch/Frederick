"""
anthropic_client.py - Lightweight Anthropic Claude client for BasicMode.
Primary LLM for basic mode. Falls back to DeepSeek if unavailable.
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


async def call_anthropic(prompt: str, max_tokens: int = 150, temperature: float = 0.8) -> Optional[str]:
    """Call Anthropic Claude API. Returns text or None on failure."""
    if not ANTHROPIC_API_KEY:
        return None

    try:
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                # Учёт расходов (fire-and-forget).
                try:
                    import asyncio as _aio
                    from services.api_usage import log_llm_usage, extract_anthropic_tokens
                    tk = extract_anthropic_tokens(data)
                    _aio.create_task(log_llm_usage(
                        provider="anthropic", model=data.get("model") or ANTHROPIC_MODEL,
                        tokens_in=tk["tokens_in"], tokens_out=tk["tokens_out"],
                        feature="basic_mode.chat",
                    ))
                except Exception as _e:
                    logger.warning(f"api_usage skip: {_e}")
                content = data.get("content", [])
                if content and len(content) > 0:
                    text = content[0].get("text", "")
                    logger.info(f"Anthropic OK: {len(text)} chars, model={data.get('model', '?')}")
                    return text
                return None
            else:
                logger.warning(f"Anthropic error: {resp.status_code} {resp.text[:200]}")
                return None

    except httpx.TimeoutException:
        logger.warning("Anthropic timeout")
        return None
    except Exception as e:
        logger.warning(f"Anthropic error: {e}")
        return None


def is_available() -> bool:
    """Check if Anthropic API key is configured."""
    return bool(ANTHROPIC_API_KEY)
