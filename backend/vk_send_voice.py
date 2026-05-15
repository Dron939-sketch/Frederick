"""
vk_send_voice.py — отправка голосового сообщения + текста в VK.

Pipeline:
  text → Fish Audio (mp3) → ffmpeg (OGG/Opus mono 16kHz 16kbps voip,
                                    как нативные voice VK Mobile)
       → docs.getMessagesUploadServer(type=audio_message, peer_id)
       → upload
       → docs.save
       → messages.send (attachment=doc{owner_id}_{id})
       → [optional] messages.send (message=text_followup)

Требования к токену в env VK_USER_TOKEN (НЕ VK_SERVICE_TOKEN!):
  - user-токен (Standalone/Implicit Flow), скоупы messages,docs,offline
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import subprocess
import tempfile
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

VK_API_BASE = "https://api.vk.com/method"
VK_API_VERSION = "5.199"
HTTP_TIMEOUT = 90.0


def _ffmpeg_mp3_to_ogg_opus(mp3_bytes: bytes) -> bytes:
    """Конвертация MP3 → OGG/Opus под VK audio_message.

    Параметры подобраны под VK Mobile нативный voice-recording:
      - container: OGG, codec: libopus
      - 16000 Hz sample rate (а не 48000 — стандарт для VK voice)
      - 16 kbps bitrate (под речь — экономит трафик)
      - mono (1 channel)
      - application=voip (опт. для речи)
      - frame_duration 60 ms (полные опус-пакеты VK любит)

    Ранее использовалось 48000 Hz / 32k — формально валидный Opus,
    но VK upload-сервер периодически возвращал «unknown error».
    Понижение до 16/16 убирает эту проблему.
    """
    if not mp3_bytes:
        raise RuntimeError("empty mp3")
    in_fd, in_path = tempfile.mkstemp(suffix=".mp3")
    out_fd, out_path = tempfile.mkstemp(suffix=".ogg")
    os.close(in_fd)
    os.close(out_fd)
    try:
        with open(in_path, "wb") as f:
            f.write(mp3_bytes)
        proc = subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", in_path,
                "-vn",
                "-c:a", "libopus",
                "-b:a", "16k",
                "-ar", "16000",
                "-ac", "1",
                "-application", "voip",
                "-frame_duration", "60",
                out_path,
            ],
            capture_output=True, timeout=60,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"ffmpeg rc={proc.returncode}: {proc.stderr.decode('utf-8', 'ignore')[:300]}"
            )
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except Exception:
                pass



# In-memory кэш MP3-«тела» сообщения по hash. Используется в split-режиме:
# тело генерится один раз, имя — каждый раз отдельно, потом склеивается.
# TTL 1 час (после рассылки кэш ни к чему).
import hashlib
import time

_BODY_CACHE: dict[str, tuple[float, bytes]] = {}
_BODY_CACHE_TTL_SEC = 3600
_BODY_CACHE_MAX = 50


def _body_cache_key(text: str, mode: str) -> str:
    h = hashlib.sha256((mode + "::" + (text or "")).encode("utf-8")).hexdigest()[:32]
    return f"{mode}::{h}"


def _body_cache_get(key: str) -> Optional[bytes]:
    rec = _BODY_CACHE.get(key)
    if not rec:
        return None
    ts, data = rec
    if time.time() - ts > _BODY_CACHE_TTL_SEC:
        _BODY_CACHE.pop(key, None)
        return None
    return data


def _body_cache_put(key: str, data: bytes) -> None:
    if not data:
        return
    # Лёгкая LRU: при переполнении выкидываем самый старый
    if len(_BODY_CACHE) >= _BODY_CACHE_MAX:
        oldest = min(_BODY_CACHE.items(), key=lambda kv: kv[1][0])[0]
        _BODY_CACHE.pop(oldest, None)
    _BODY_CACHE[key] = (time.time(), data)


def _ffmpeg_concat_mp3(parts: list[bytes], pause_ms: int = 350) -> bytes:
    """Склеивает несколько MP3 в один с тихой паузой между.
    Используется чтобы «имя» (короткий TTS) и «тело» (кэшированный TTS)
    звучали как единое сообщение.
    """
    if not parts:
        raise RuntimeError("nothing to concat")
    if len(parts) == 1:
        return parts[0]
    tmp_files: list[str] = []
    list_path = None
    out_path = None
    try:
        for i, b in enumerate(parts):
            fd, p = tempfile.mkstemp(suffix=f"_part{i}.mp3")
            os.close(fd)
            with open(p, "wb") as f:
                f.write(b)
            tmp_files.append(p)
        # silent gap
        fd_silence, silence_path = tempfile.mkstemp(suffix="_silence.mp3")
        os.close(fd_silence)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono",
             "-t", f"{pause_ms/1000:.3f}",
             "-c:a", "libmp3lame", "-b:a", "128k",
             silence_path],
            check=True, capture_output=True, timeout=10,
        )
        # build concat list: part0 silence part1 silence part2 ...
        list_fd, list_path = tempfile.mkstemp(suffix=".txt")
        os.close(list_fd)
        with open(list_path, "w", encoding="utf-8") as f:
            for i, p in enumerate(tmp_files):
                f.write(f"file '{p}'\n")
                if i < len(tmp_files) - 1:
                    f.write(f"file '{silence_path}'\n")
        out_fd, out_path = tempfile.mkstemp(suffix="_concat.mp3")
        os.close(out_fd)
        proc = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "concat", "-safe", "0", "-i", list_path,
             "-c:a", "libmp3lame", "-b:a", "128k",
             out_path],
            capture_output=True, timeout=30,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"concat ffmpeg failed: {proc.stderr.decode('utf-8','ignore')[:200]}")
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        for p in tmp_files + ([list_path] if list_path else []) + ([out_path] if out_path else []):
            try: os.unlink(p)
            except Exception: pass
        try: os.unlink(silence_path)
        except Exception: pass


async def _vk_method(method: str, params: dict) -> Any:
    """Вызов VK API method от ИМЕНИ ОТПРАВИТЕЛЯ (user-токен).
    Используется только для messages.* и docs.*. Парсер живёт на отдельном
    VK_SERVICE_TOKEN и сюда не заходит."""
    token = (os.environ.get("VK_USER_TOKEN") or "").strip()
    if not token:
        raise RuntimeError(
            "VK_USER_TOKEN не задан в env Render. "
            "Это user-токен с правами messages,docs,offline — отдельно от "
            "VK_SERVICE_TOKEN (тот для парсера). Получить через Standalone "
            "Implicit Flow: oauth.vk.com/authorize?client_id=APP_ID&"
            "scope=messages,docs,offline&response_type=token&v=5.199"
        )
    body = {**params, "access_token": token, "v": VK_API_VERSION}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(f"{VK_API_BASE}/{method}", data=body)
    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"VK {method}: non-JSON {resp.status_code}: {resp.text[:200]}")
    if "error" in data:
        err = data["error"]
        code = err.get("error_code")
        msg = err.get("error_msg") or "unknown"
        hint = ""
        if code == 5:
            hint = (" — нужен user-токен с правами messages,docs,offline "
                    "(Standalone Implicit Flow). Текущий VK_USER_TOKEN не "
                    "подходит — может это service-токен, или скоупы не "
                    "запрашивались. Пересоздай через oauth.vk.com/authorize "
                    "со scope=messages,docs,offline.")
        elif code == 15:
            hint = " — токен не имеет нужных скоупов либо адресат закрыл личку."
        raise RuntimeError(f"VK {method}: {code}/{msg}{hint}")
    return data.get("response", data)


async def _vk_token_info() -> dict:
    """Диагностика VK_USER_TOKEN."""
    base = {"env_var": "VK_USER_TOKEN"}
    token = (os.environ.get("VK_USER_TOKEN") or "").strip()
    if not token:
        return {
            **base,
            "token_type": "missing",
            "can_send_messages": False,
            "hint": (
                "Не задан. Получи user-токен через "
                "oauth.vk.com/authorize?client_id=APP_ID&"
                "scope=messages,docs,offline&response_type=token&v=5.199, "
                "положи в Render env как VK_USER_TOKEN, перезапусти сервис."
            ),
        }
    try:
        resp = await _vk_method("users.get", {})
        if isinstance(resp, list) and resp and resp[0].get("id"):
            u = resp[0]
            return {
                **base,
                "token_type": "user",
                "user_id": u.get("id"),
                "name": f"{u.get('first_name','')} {u.get('last_name','')}".strip(),
                "can_send_messages": True,
            }
        return {
            **base,
            "token_type": "group_or_unknown",
            "can_send_messages": True,
            "hint": "users.get вернул пусто — вероятно group-token.",
        }
    except RuntimeError as e:
        msg = str(e)
        if "100" in msg or "user_ids" in msg.lower():
            return {
                **base,
                "token_type": "service",
                "can_send_messages": False,
                "hint": "Service-токен. messages.send и docs.* недоступны.",
            }
        return {
            **base,
            "token_type": "error",
            "can_send_messages": False,
            "error": msg,
        }


async def send_voice_message_to_vk(
    voice_text: str,
    vk_peer_id: int,
    text_followup: Optional[str] = None,
    mp3_synthesizer=None,
) -> dict:
    """Полный pipeline: TTS → конверт → upload → send voice → (опц) send text."""
    if not voice_text or not voice_text.strip():
        raise RuntimeError("voice_text пуст")
    peer_id = int(vk_peer_id)
    if peer_id <= 0:
        raise RuntimeError("vk_peer_id должен быть положительным")

    # 1. Synth MP3
    if mp3_synthesizer is None:
        from services.fish_audio_service import synthesize_fish_audio
        mp3 = await synthesize_fish_audio(voice_text.strip(), mode="psychologist")
    else:
        mp3 = await mp3_synthesizer(voice_text.strip())
    if not mp3 or len(mp3) < 200:
        raise RuntimeError("TTS вернул пусто — проверь FISH_AUDIO_API_KEY и баланс")

    # 2. MP3 → OGG/Opus (sync ffmpeg в потоке)
    ogg = await asyncio.to_thread(_ffmpeg_mp3_to_ogg_opus, mp3)
    if not ogg or len(ogg) < 200:
        raise RuntimeError("ffmpeg вернул пустой OGG")

    # Sanity-check: первые 4 байта валидного OGG — «OggS».
    ogg_magic = ogg[:4]
    if ogg_magic != b"OggS":
        raise RuntimeError(
            f"invalid OGG header: первые 4 байта {ogg_magic!r} ≠ b'OggS'. "
            f"ffmpeg вернул битый файл, размер={len(ogg)} байт"
        )

    # 3. Get upload server
    server = await _vk_method(
        "docs.getMessagesUploadServer",
        {"type": "audio_message", "peer_id": peer_id},
    )
    upload_url = server.get("upload_url") if isinstance(server, dict) else None
    if not upload_url:
        raise RuntimeError(f"upload_url не вернулся: {server}")

    # 4. Upload OGG как multipart
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        upload_resp = await client.post(
            upload_url,
            files={"file": ("voice.ogg", ogg, "audio/ogg")},
        )
    try:
        up = upload_resp.json()
    except Exception:
        raise RuntimeError(
            f"upload non-JSON: {upload_resp.status_code} {upload_resp.text[:200]}"
        )
    if "file" not in up:
        logger.error(
            f"VK upload отклонил OGG: size={len(ogg)}B, magic={ogg_magic!r}, "
            f"upload_resp={up}"
        )
        raise RuntimeError(
            f"upload не вернул 'file': {up} "
            f"(OGG size={len(ogg)}B, header=OK). "
            f"Если 'unknown error' — VK не принял формат. Параметры ffmpeg: "
            f"16kHz/16kbps/voip/frame=60ms. После деплоя нужного коммита — "
            f"перезапусти сервис."
        )

    # 5. docs.save
    saved = await _vk_method("docs.save", {"file": up["file"]})
    doc = None
    if isinstance(saved, dict):
        doc = saved.get("audio_message") or saved.get("doc")
        if not doc and saved.get("type") == "audio_message":
            doc = saved.get(saved["type"])
    elif isinstance(saved, list) and saved:
        doc = saved[0]
    if not doc or "id" not in doc:
        raise RuntimeError(f"docs.save unexpected: {saved}")

    owner_id = doc.get("owner_id")
    doc_id = doc.get("id")
    attachment = f"doc{owner_id}_{doc_id}"

    # 6. Send voice
    voice_msg_id = await _vk_method("messages.send", {
        "peer_id": peer_id,
        "random_id": random.randint(1, 2**31 - 1),
        "attachment": attachment,
    })

    # 7. Текст вдогонку
    text_msg_id = None
    if text_followup and text_followup.strip():
        text_msg_id = await _vk_method("messages.send", {
            "peer_id": peer_id,
            "random_id": random.randint(1, 2**31 - 1),
            "message": text_followup.strip(),
            "dont_parse_links": 0,
        })

    logger.info(
        f"📨 VK voice sent: peer={peer_id} mp3={len(mp3)}B ogg={len(ogg)}B "
        f"voice_msg_id={voice_msg_id} text_msg_id={text_msg_id}"
    )
    return {
        "voice_message_id": voice_msg_id,
        "text_message_id": text_msg_id,
        "voice_attachment": attachment,
        "mp3_size": len(mp3),
        "ogg_size": len(ogg),
        "peer_id": peer_id,
    }



async def send_voice_with_split(
    voice_name_text: str,
    voice_body_text: str,
    vk_peer_id: int,
    text_followup: Optional[str] = None,
    pause_ms: int = 350,
    mode: str = "psychologist",
) -> dict:
    """Pipeline в «split» режиме:
       - voice_body_text озвучивается ОДИН раз и кэшируется по hash;
       - voice_name_text озвучивается каждый раз заново (он персональный);
       - оба MP3 склеиваются ffmpeg-ом с короткой паузой и отправляются как один voice.

    Полезно для рассылок: тело сообщения одинаковое у всех, имя — разное.
    Экономит ~80% TTS-вызовов на основной текст и даёт стабильное качество
    «эмоциональной» озвучки тела.
    """
    from services.fish_audio_service import synthesize_fish_audio

    peer_id = int(vk_peer_id)
    if peer_id <= 0:
        raise RuntimeError("vk_peer_id должен быть положительным")
    voice_name_text = (voice_name_text or "").strip()
    voice_body_text = (voice_body_text or "").strip()
    if not voice_body_text and not voice_name_text:
        raise RuntimeError("оба текста пусты")

    # 1) Тело — из кэша или генерим
    body_mp3: Optional[bytes] = None
    if voice_body_text:
        key = _body_cache_key(voice_body_text, mode)
        body_mp3 = _body_cache_get(key)
        if not body_mp3:
            body_mp3 = await synthesize_fish_audio(voice_body_text, mode=mode)
            if not body_mp3 or len(body_mp3) < 200:
                raise RuntimeError("TTS body пустой — проверь FISH_AUDIO_API_KEY/баланс")
            _body_cache_put(key, body_mp3)
            logger.info(f"split: body TTS сгенерировано и кэшировано ({len(body_mp3)}B)")
        else:
            logger.info(f"split: body MP3 из кэша ({len(body_mp3)}B)")

    # 2) Имя — каждый раз новое
    name_mp3: Optional[bytes] = None
    if voice_name_text:
        name_mp3 = await synthesize_fish_audio(voice_name_text, mode=mode)
        if not name_mp3 or len(name_mp3) < 200:
            raise RuntimeError("TTS name пустой")

    # 3) Concat (если обе части)
    parts = [p for p in (name_mp3, body_mp3) if p]
    if not parts:
        raise RuntimeError("обе части пустые")
    full_mp3 = await asyncio.to_thread(_ffmpeg_concat_mp3, parts, pause_ms)
    if not full_mp3 or len(full_mp3) < 200:
        raise RuntimeError("concat вернул пустой MP3")

    # 4) Дальше — обычный путь: MP3 → OGG → upload → send
    return await send_voice_message_to_vk(
        voice_text="<<split>>",  # не используется, передаём готовый mp3 через synthesizer
        vk_peer_id=peer_id,
        text_followup=text_followup,
        mp3_synthesizer=(lambda _t: _identity_mp3(full_mp3)),
    )


async def _identity_mp3(mp3: bytes) -> bytes:
    return mp3
