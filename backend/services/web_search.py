"""
web_search.py — Lightweight web search adapter for BasicMode tool-use.

Backends, in order:
  1. Brave Search API (requires BRAVE_SEARCH_API_KEY).
  2. Disabled stub — returns informative message that LLM can interpret
     so the model can degrade gracefully ("точные цифры могли поменяться,
     у меня нет доступа к live-данным").

Each backend returns a list of {title, snippet, url} dicts, capped at `count`.
"""

import os
import logging
from typing import Dict, List

import httpx

logger = logging.getLogger(__name__)

BRAVE_API_KEY = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

DISABLED_NOTE = (
    "Web search backend is not configured (BRAVE_SEARCH_API_KEY not set). "
    "Tell the user honestly that you can't fetch live data and offer a "
    "criteria-based answer instead."
)


def is_available() -> bool:
    return bool(BRAVE_API_KEY)


async def search(
    query: str,
    count: int = 5,
    country: str = "RU",
    lang: str = "ru",
) -> List[Dict[str, str]]:
    """Search the web. Returns up to `count` results.

    On disabled / failure: returns a single synthetic result whose snippet
    explains the situation, so the LLM can degrade gracefully.
    """
    q = (query or "").strip()
    if not q:
        return [{"title": "", "snippet": "Empty query.", "url": ""}]

    if not BRAVE_API_KEY:
        return [{"title": "", "snippet": DISABLED_NOTE, "url": ""}]

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                BRAVE_URL,
                params={
                    "q": q[:400],
                    "count": min(max(count, 1), 10),
                    "country": country,
                    "search_lang": lang,
                    "safesearch": "moderate",
                },
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": BRAVE_API_KEY,
                },
            )
            if resp.status_code != 200:
                logger.warning(f"Brave search {resp.status_code}: {resp.text[:200]}")
                return [{
                    "title": "",
                    "snippet": f"Search backend returned HTTP {resp.status_code}.",
                    "url": "",
                }]
            data = resp.json()
            results = (data.get("web") or {}).get("results") or []
            out: List[Dict[str, str]] = []
            for r in results[:count]:
                snippet = (r.get("description") or "").strip()
                if not snippet:
                    extras = r.get("extra_snippets") or []
                    if extras:
                        snippet = str(extras[0]).strip()
                out.append({
                    "title": (r.get("title") or "").strip()[:200],
                    "snippet": snippet[:400],
                    "url": (r.get("url") or "").strip()[:200],
                })
            if not out:
                return [{"title": "", "snippet": "No results.", "url": ""}]
            return out
    except httpx.TimeoutException:
        logger.warning("Brave search timeout")
        return [{"title": "", "snippet": "Search timed out.", "url": ""}]
    except Exception as e:
        logger.warning(f"Brave search error: {e}")
        return [{"title": "", "snippet": f"Search error: {e}", "url": ""}]


def format_results_for_prompt(results: List[Dict[str, str]]) -> str:
    """Compact textual form for tool_result content sent back to the model."""
    if not results:
        return "No results."
    lines = []
    for i, r in enumerate(results, 1):
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or "").strip()
        url = (r.get("url") or "").strip()
        if title:
            line = f"{i}. {title}"
        else:
            line = f"{i}."
        if snippet:
            line += f"\n   {snippet}"
        if url:
            line += f"\n   {url}"
        lines.append(line)
    return "\n".join(lines)
