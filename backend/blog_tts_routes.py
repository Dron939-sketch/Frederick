# -*- coding: utf-8 -*-
"""Озвучка статей блога голосом Yandex SpeechKit.

Принцип: генерируем ОДИН раз, сохраняем в data/tts_blog/{slug}.mp3
и дальше отдаём файл. Первый слушатель ждёт генерацию (~15–30 сек),
остальные получают мгновенно. Ключ — тот же YANDEX_API_KEY, что и
у голоса Фреди; если ключа нет, эндпоинты честно отвечают disabled,
и фронт откатывается на браузерный синтез.
"""
import asyncio
import html as html_mod
import logging
import os
import re

import httpx
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse

logger = logging.getLogger(__name__)

YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
TTS_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"
BLOG_TTS_VOICE = os.getenv("BLOG_TTS_VOICE", "alena")
BLOG_TTS_SPEED = os.getenv("BLOG_TTS_SPEED", "1.0")
SITE_BASE = os.getenv("BLOG_TTS_SITE", "https://meysternlp.ru")

TTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tts_blog")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,120}$")
CHUNK_LIMIT = 4500          # лимит Yandex v1 — 5000 символов на запрос
MAX_ARTICLE_CHARS = 60000   # предохранитель от аномально длинных страниц

# Блоки, которые не читаем вслух (виджеты, ссылки, служебное)
_SKIP_BLOCK_RE = re.compile(
    r'<div class="(?:selfcheck|fredi-ask-box|game-link-box|related-articles|'
    r'author-block|author-box|cta-block|toc-box)".*?</div>\s*</div>|'
    r'<div class="(?:selfcheck|fredi-ask-box|game-link-box|toc-box)".*?</div>',
    re.S,
)

_locks: dict = {}


def _extract_text(page: str) -> str:
    """Достаёт из HTML статьи связный текст для озвучки."""
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    title = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""

    body = page
    mc = re.search(r'<div class="article-content">(.*)</div>\s*\n*<div class="cta-block">', page, re.S)
    if not mc:
        mc = re.search(r'<div class="article-content">(.*?)<div class="related-articles">', page, re.S)
    if mc:
        body = mc.group(1)

    # выкидываем скрипты/стили и нечитаемые блоки
    body = re.sub(r"<script.*?</script>", " ", body, flags=re.S)
    body = re.sub(r"<style.*?</style>", " ", body, flags=re.S)
    for _ in range(3):
        body = _SKIP_BLOCK_RE.sub(" ", body)

    parts = [title + "."] if title else []
    for tag_m in re.finditer(r"<(h2|h3|p|li)[^>]*>(.*?)</\1>", body, re.S):
        t = re.sub(r"<[^>]+>", " ", tag_m.group(2))
        t = html_mod.unescape(t)
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) < 3:
            continue
        # эмодзи и прочие пиктограммы диктору не нужны
        t = re.sub(
            "[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]", "", t
        ).strip()
        if not t:
            continue
        if not t.endswith((".", "!", "?", ":", ";")):
            t += "."
        parts.append(t)
    text = " ".join(parts)
    return text[:MAX_ARTICLE_CHARS]


def _chunks(text: str):
    """Режет текст на куски ≤ CHUNK_LIMIT по границам предложений."""
    out, cur = [], ""
    for sent in re.split(r"(?<=[.!?;]) +", text):
        if len(cur) + len(sent) + 1 > CHUNK_LIMIT:
            if cur:
                out.append(cur)
            while len(sent) > CHUNK_LIMIT:  # аномально длинное «предложение»
                out.append(sent[:CHUNK_LIMIT])
                sent = sent[CHUNK_LIMIT:]
            cur = sent
        else:
            cur = (cur + " " + sent).strip()
    if cur:
        out.append(cur)
    return out


async def _synth_chunk(client: httpx.AsyncClient, text: str) -> bytes:
    resp = await client.post(
        TTS_URL,
        headers={"Authorization": f"Api-Key {YANDEX_API_KEY}"},
        data={
            "text": text,
            "lang": "ru-RU",
            "voice": BLOG_TTS_VOICE,
            "speed": BLOG_TTS_SPEED,
            "format": "mp3",
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.content


async def _generate(slug: str) -> str:
    """Скачивает статью, синтезирует и кладёт mp3 в кэш. Возвращает путь."""
    os.makedirs(TTS_DIR, exist_ok=True)
    path = os.path.join(TTS_DIR, f"{slug}.mp3")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path

    async with httpx.AsyncClient(timeout=30) as client:
        page = await client.get(f"{SITE_BASE}/blog/{slug}.html")
        if page.status_code != 200:
            raise FileNotFoundError(f"article {slug} -> {page.status_code}")
        text = _extract_text(page.text)
        if len(text) < 200:
            raise ValueError(f"article {slug}: extracted text too short")

        chunks = _chunks(text)
        logger.info(f"blog-tts {slug}: {len(text)} chars, {len(chunks)} chunks")
        audio = b""
        for ch in chunks:
            audio += await _synth_chunk(client, ch)

    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(audio)
    os.replace(tmp, path)

    try:
        from services.api_usage import log_tts_usage
        asyncio.create_task(log_tts_usage(
            provider="yandex", model=BLOG_TTS_VOICE,
            chars=len(text), feature="tts.blog_article",
        ))
    except Exception:
        pass

    logger.info(f"blog-tts {slug}: saved {len(audio)} bytes")
    return path


def register_blog_tts_routes(app, limiter):

    @app.get("/api/tts/blog/{slug}/status")
    @limiter.limit("60/minute")
    async def blog_tts_status(request: Request, slug: str):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"enabled": False}, status_code=400)
        if not YANDEX_API_KEY:
            return {"enabled": False}
        path = os.path.join(TTS_DIR, f"{slug}.mp3")
        ready = os.path.exists(path) and os.path.getsize(path) > 1000
        return {"enabled": True, "ready": ready, "url": f"/api/tts/blog/{slug}.mp3"}

    @app.get("/api/tts/blog/{slug}.mp3")
    @limiter.limit("20/minute")
    async def blog_tts_audio(request: Request, slug: str):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"error": "bad slug"}, status_code=400)
        if not YANDEX_API_KEY:
            return JSONResponse({"error": "tts disabled"}, status_code=503)

        path = os.path.join(TTS_DIR, f"{slug}.mp3")
        if not (os.path.exists(path) and os.path.getsize(path) > 1000):
            # один слуг — одна генерация: параллельные запросы ждут первую
            lock = _locks.setdefault(slug, asyncio.Lock())
            async with lock:
                if not (os.path.exists(path) and os.path.getsize(path) > 1000):
                    try:
                        await _generate(slug)
                    except FileNotFoundError:
                        return JSONResponse({"error": "article not found"}, status_code=404)
                    except Exception as e:
                        logger.error(f"blog-tts {slug} failed: {e}")
                        return JSONResponse({"error": "generation failed"}, status_code=502)

        return FileResponse(
            path,
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    logger.info("Blog TTS routes registered (voice=%s, enabled=%s)", BLOG_TTS_VOICE, bool(YANDEX_API_KEY))
