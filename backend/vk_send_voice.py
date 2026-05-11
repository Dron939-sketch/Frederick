"""
vk_send_voice.py — отправка голосового сообщения + текста в VK.

Pipeline:
  text → Fish Audio (mp3) → ffmpeg (OGG/Opus mono 48k 32kbps voip)
       → docs.getMessagesUploadServer(type=audio_message, peer_id)
       → upload
       → docs.save
       → messages.send (attachment=doc{owner_id}_{id})
       → [optional] messages.send (message=text_followup)

Требования к токену в env VK_USER_TOKEN (НЕ VK_SERVICE_TOKEN!):
  - user-токен (Standalone/Implicit Flow), скоупы messages,docs,offline
  - либо group-токен с правом messages

VK_SERVICE_TOKEN — отдельная переменная для парсера/поиска кандидатов
(там нужен именно service-токен, у него выше квоты на публичные endpoint'ы).
Не путать: парсер ↔ service, отправка ↔ user.

Если в VK_USER_TOKEN положить service-токен — будет 5/User authorization failed
или 15/Access denied.

VK API строго требует:
  - OGG/Opus (не Vorbis, не mp3)
  - peer_id уже в getMessagesUploadServer (не в save и не позже)
  - random_id в messages.send (защита от дублей)
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
    """Синхронная конвертация MP3 → OGG/Opus mono 48k 32kbps voip.

    Запускается через asyncio.to_thread из async-кода.
    Возвращает байты OGG. Бросает RuntimeError при сбое ffmpeg.
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
        # -application voip — оптимизация opus-кодека под речь.
        # 32 kbps — VK прекрасно принимает, файл компактный (~250 КБ за 60 сек).
        proc = subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", in_path,
                "-c:a", "libopus",
                "-b:a", "32k",
                "-ar", "48000",
                "-ac", "1",
                "-application", "voip",
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
        # 5 = User authorization failed (service-token не умеет messages),
        # 15 = Access denied, 100 = invalid params, 113 = invalid user_id
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
    """Диагностика VK_USER_TOKEN: user / group / service / не задан.
    Делает users.get без user_ids — user-token вернёт самого себя,
    service-token ошибку 100, group-token — пустой массив или ошибку 27."""
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
        # Пустой массив часто значит group-token (тот не имеет «себя» как юзера).
        return {
            **base,
            "token_type": "group_or_unknown",
            "can_send_messages": True,  # group-token тоже умеет messages.send
            "hint": "users.get вернул пусто — вероятно group-token. Для рассылки от group подходит, но рыбак увидит группу, а не личный профиль.",
        }
    except RuntimeError as e:
        msg = str(e)
        if "100" in msg or "user_ids" in msg.lower():
            return {
                **base,
                "token_type": "service",
                "can_send_messages": False,
                "hint": "Service-токен. messages.send и docs.* недоступны. Нужен user-токен.",
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
    """Полный pipeline: TTS → конверт → upload → send voice → (опц) send text.

    Args:
        voice_text: текст для озвучки (без эмодзи/URL — желательно уже sanitized)
        vk_peer_id: id рыбака (для личного сообщения = user_id)
        text_followup: текст письма, который шлём вторым сообщением (опц)
        mp3_synthesizer: callable(text) -> bytes; если None — Fish Audio

    Returns dict с message_id'ами обоих сообщений и размерами файлов.
    Бросает RuntimeError с понятным сообщением при любой ошибке.
    """
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

    # 3. Get upload server (peer_id обязателен на этом шаге для audio_message)
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
        raise RuntimeError(f"upload non-JSON: {upload_resp.status_code} {upload_resp.text[:200]}")
    if "file" not in up:
        raise RuntimeError(f"upload не вернул 'file': {up}")

    # 5. docs.save — превращает upload-токен в постоянный doc
    saved = await _vk_method("docs.save", {"file": up["file"]})
    # Формат ответа для audio_message: {type: 'audio_message', audio_message: {...}}
    # либо просто {audio_message: {...}} в зависимости от версии API.
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

    # 6. Send voice сообщение
    voice_msg_id = await _vk_method("messages.send", {
        "peer_id": peer_id,
        "random_id": random.randint(1, 2**31 - 1),
        "attachment": attachment,
        # «message» оставляем пустым — это голосовое, без текстовой подписи.
    })

    # 7. Текст вдогонку
    text_msg_id = None
    if text_followup and text_followup.strip():
        text_msg_id = await _vk_method("messages.send", {
            "peer_id": peer_id,
            "random_id": random.randint(1, 2**31 - 1),
            "message": text_followup.strip(),
            "dont_parse_links": 0,  # хотим чтобы ссылка на демо превратилась в превью
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
