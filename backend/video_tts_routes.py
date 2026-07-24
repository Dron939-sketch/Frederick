# -*- coding: utf-8 -*-
"""Озвучка для видео-роликов Лектория голосом Фреди (Fish Audio).

Источник правды по озвучке — здесь, в Frederick: ключ Fish уже живёт в env
этого сервера, поэтому видео-«завод» (репозиторий 999) НЕ хранит ключ у себя,
а просто запрашивает аудио по стабильному URL.

Принцип (как и у блога): синтезируем ОДИН раз, кэшируем mp3 на постоянном
диске (/data/tts_video/<hash>.mp3), дальше отдаём файл. Ключ кэша — sha256 от
текста (+голоса), поэтому одинаковые реплики не переозвучиваются и не тарифи-
цируются повторно.

Эндпоинты:
  POST /api/tts/video/say         (admin) {"text": "..."} → mp3 (Фреди), кэш
  GET  /api/tts/video/say/<hash>.mp3        → отдать кэш (или 404)

Гейт: заголовок `X-Admin: <ADMIN_TOKEN>` (тот же токен, что у аналитики).
Ассемблирование дорожки по таймкодам (паузы/склейка) делает сторона 999 —
там есть ffmpeg; сервер отдаёт озвучку по одной реплике и хранит её.
"""
import hashlib
import logging
import os
import re

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

logger = logging.getLogger(__name__)

# mp3 на постоянном диске Amvera (/data), чтобы переживало редеплой; локально —
# рядом с бэкендом. Переопределяется через VIDEO_TTS_DIR.
_DEFAULT_DIR = (
    "/data/tts_video" if os.path.isdir("/data")
    else os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tts_video")
)
VIDEO_TTS_DIR = os.getenv("VIDEO_TTS_DIR", _DEFAULT_DIR)

HASH_RE = re.compile(r"^[a-f0-9]{16,64}$")
MAX_CHARS = 6000          # предохранитель на реплику
FISH_CHUNK_LIMIT = 1400   # Fish медленно тянет длинные куски → режем
FISH_TIMEOUT = 120.0


def _check_admin(token):
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail={
            "error": "admin_disabled",
            "message": "Задайте ADMIN_TOKEN в env, чтобы включить видео-озвучку."})
    if not token or token != expected:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


def _key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{voice}\n{text}".encode("utf-8")).hexdigest()[:24]


def _chunks(text: str, limit: int = FISH_CHUNK_LIMIT):
    """Режем длинный текст по границам предложений под лимит Fish."""
    text = text.strip()
    if len(text) <= limit:
        return [text]
    parts, buf = [], ""
    for sent in re.split(r"(?<=[.!?…])\s+", text):
        if len(buf) + len(sent) + 1 > limit and buf:
            parts.append(buf.strip())
            buf = ""
        buf += sent + " "
    if buf.strip():
        parts.append(buf.strip())
    return parts


async def _synth(text: str) -> bytes:
    """Синтез реплики голосом Фреди (Fish). mp3-байты (склейка кусков)."""
    from services.fish_audio_service import synthesize_fish_audio, fish_configured
    if not fish_configured():
        raise HTTPException(status_code=503, detail={
            "error": "fish_not_configured",
            "message": "Нет FISH_AUDIO_API_KEY/VOICE_ID — голос Фреди недоступен."})
    parts = []
    for ch in _chunks(text):
        audio = await synthesize_fish_audio(ch, timeout=FISH_TIMEOUT)
        if not audio:
            raise HTTPException(status_code=502, detail={
                "error": "synth_failed", "message": "Fish вернул пустое аудио."})
        parts.append(audio)
    return b"".join(parts)


def register_video_tts_routes(app, limiter):
    """Регистрирует эндпоинты видео-озвучки. Вызывать из main рядом с блогом."""

    @app.post("/api/tts/video/say")
    async def video_tts_say(request: Request):
        _check_admin(request.headers.get("X-Admin"))
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail={"error": "bad_json"})
        text = (body or {}).get("text", "").strip()
        voice = (body or {}).get("voice", "fish").strip() or "fish"
        if not text:
            raise HTTPException(status_code=400, detail={"error": "empty_text"})
        if len(text) > MAX_CHARS:
            raise HTTPException(status_code=413, detail={"error": "text_too_long"})

        os.makedirs(VIDEO_TTS_DIR, exist_ok=True)
        h = _key(text, voice)
        path = os.path.join(VIDEO_TTS_DIR, f"{h}.mp3")
        if not (os.path.exists(path) and os.path.getsize(path) > 0):
            audio = await _synth(text)
            tmp = path + ".tmp"
            with open(tmp, "wb") as f:
                f.write(audio)
            os.replace(tmp, path)
            logger.info(f"video-tts: synth {h} ({len(audio)} bytes) «{text[:40]}…»")
        return FileResponse(
            path, media_type="audio/mpeg",
            headers={"X-TTS-Hash": h, "X-TTS-Url": f"/api/tts/video/say/{h}.mp3"})

    @app.get("/api/tts/video/say/{h}.mp3")
    async def video_tts_get(h: str):
        if not HASH_RE.match(h):
            raise HTTPException(status_code=400, detail={"error": "bad_hash"})
        path = os.path.join(VIDEO_TTS_DIR, f"{h}.mp3")
        if not (os.path.exists(path) and os.path.getsize(path) > 0):
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        return FileResponse(path, media_type="audio/mpeg")

    @app.get("/api/tts/video/health")
    async def video_tts_health():
        try:
            from services.fish_audio_service import fish_configured
            fish = fish_configured()
        except Exception:
            fish = False
        return JSONResponse({
            "enabled": bool((os.environ.get("ADMIN_TOKEN") or "").strip()),
            "fish": fish, "dir": VIDEO_TTS_DIR})
