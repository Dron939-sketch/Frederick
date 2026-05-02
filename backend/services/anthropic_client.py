"""
anthropic_client.py — Anthropic Claude client for BasicMode.

Two entry points:
  • call_anthropic(prompt) — plain text-in / text-out. Used by
    life_experience and mode_enhancer where tools and caching are
    overkill.
  • call_anthropic_with_tools(system, messages, tools, tool_executor) —
    tool-use loop with prompt-cached system prefix. Used by BasicMode
    for the main reply so the model can call get_current_datetime,
    get_weather, and web_search when the user asks for live data.
"""

import logging
import os
from typing import Awaitable, Callable, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
# Default to Sonnet 4.6 — better at the pattern-naming / inferential moves
# the basic-mode preset asks for. Override with ANTHROPIC_MODEL env var.
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6").strip()
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


def is_available() -> bool:
    return bool(ANTHROPIC_API_KEY)


def _headers() -> Dict[str, str]:
    return {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }


def _log_usage(data: Dict, feature: str) -> None:
    try:
        import asyncio as _aio
        from services.api_usage import extract_anthropic_tokens, log_llm_usage
        tk = extract_anthropic_tokens(data)
        _aio.create_task(log_llm_usage(
            provider="anthropic",
            model=data.get("model") or ANTHROPIC_MODEL,
            tokens_in=tk["tokens_in"],
            tokens_out=tk["tokens_out"],
            feature=feature,
        ))
    except Exception as _e:
        logger.debug(f"api_usage skip: {_e}")


async def call_anthropic(
    prompt: str,
    max_tokens: int = 150,
    temperature: float = 0.8,
) -> Optional[str]:
    """Plain prompt → text. Single round-trip, no tools, no caching."""
    if not ANTHROPIC_API_KEY:
        return None
    try:
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(ANTHROPIC_API_URL, json=payload, headers=_headers())
            if resp.status_code != 200:
                logger.warning(f"Anthropic error: {resp.status_code} {resp.text[:200]}")
                return None
            data = resp.json()
            _log_usage(data, "basic_mode.chat")
            for block in data.get("content") or []:
                if block.get("type") == "text":
                    text = (block.get("text") or "").strip()
                    if text:
                        logger.info(f"Anthropic OK: {len(text)} chars, model={data.get('model','?')}")
                        return text
            return None
    except httpx.TimeoutException:
        logger.warning("Anthropic timeout")
        return None
    except Exception as e:
        logger.warning(f"Anthropic error: {e}")
        return None


ToolExecutor = Callable[[str, dict], Awaitable[str]]


async def call_anthropic_with_tools(
    system_text: str,
    messages: List[Dict],
    tools: Optional[List[Dict]] = None,
    tool_executor: Optional[ToolExecutor] = None,
    max_tokens: int = 400,
    temperature: float = 0.8,
    max_tool_iterations: int = 4,
    cache_system: bool = True,
    feature: str = "basic_mode.chat",
) -> Optional[str]:
    """Tool-use loop. `messages` is mutated in place with assistant turns
    and tool_result turns so the conversation stays consistent across iterations.

    Stops when:
      • model emits stop_reason != "tool_use" (returns concatenated text);
      • exceeds max_tool_iterations (returns last text we got, if any);
      • API error / timeout (returns last text we got, or None).
    """
    if not ANTHROPIC_API_KEY:
        return None

    if cache_system and system_text:
        system_param = [{
            "type": "text",
            "text": system_text,
            "cache_control": {"type": "ephemeral"},
        }]
    else:
        system_param = system_text or ""

    last_text: Optional[str] = None

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            for _ in range(max_tool_iterations + 1):
                payload: Dict = {
                    "model": ANTHROPIC_MODEL,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_param,
                    "messages": messages,
                }
                if tools:
                    payload["tools"] = tools

                resp = await client.post(
                    ANTHROPIC_API_URL, json=payload, headers=_headers()
                )
                if resp.status_code != 200:
                    logger.warning(
                        f"Anthropic error {resp.status_code}: {resp.text[:300]}"
                    )
                    return last_text

                data = resp.json()
                _log_usage(data, feature)

                content = data.get("content") or []
                stop_reason = data.get("stop_reason")

                # Always extract any text we got — keep as fallback.
                text_parts = [
                    b.get("text", "") for b in content if b.get("type") == "text"
                ]
                joined = "".join(text_parts).strip()
                if joined:
                    last_text = joined

                if stop_reason != "tool_use" or not tool_executor:
                    return last_text

                # Append assistant turn (full content blocks, including tool_use).
                messages.append({"role": "assistant", "content": content})

                tool_use_blocks = [b for b in content if b.get("type") == "tool_use"]
                tool_results: List[Dict] = []
                for block in tool_use_blocks:
                    name = block.get("name", "")
                    tool_input = block.get("input", {}) or {}
                    block_id = block.get("id", "")
                    try:
                        result_text = await tool_executor(name, tool_input)
                    except Exception as e:
                        logger.warning(f"tool '{name}' raised: {e}")
                        result_text = f"Tool error: {e}"
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block_id,
                        "content": (result_text or "")[:4000],
                    })
                messages.append({"role": "user", "content": tool_results})

            logger.info(
                f"Anthropic tool loop hit max_iterations={max_tool_iterations}"
            )
            return last_text

    except httpx.TimeoutException:
        logger.warning("Anthropic timeout (tool loop)")
        return last_text
    except Exception as e:
        logger.warning(f"Anthropic tool loop error: {e}")
        return last_text
