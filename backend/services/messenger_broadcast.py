#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/messenger_broadcast.py
Массовая рассылка по собранным MAX/Telegram chat_id.

Цель: использовать собранные точки контакта (fredi_messenger_links)
как канал реактивации — слать дайджесты, апселл подписки, релизы.

Защита от спама:
  • rate-limit: 1 сек между отправками одной платформы
  • cooldown 24ч на chat_id для одного и того же broadcast_kind
    (через fredi_broadcast_log)
  • опциональный test_chat_id — отправить только в один чат
    (для админа сначала проверить)
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = (os.environ.get("TELEGRAM_TOKEN") or "").strip()
MAX_TOKEN = (os.environ.get("MAX_TOKEN") or "").strip()

# 1 сек между отправками одной платформы — VK/TG/MAX rate-limit safe.
DEFAULT_DELAY_SEC = 1.0
MAX_BROADCAST_SIZE = 5000  # защита от случайного «отправить миллиону»


BROADCAST_LOG_SQL = """
CREATE TABLE IF NOT EXISTS fredi_broadcast_log (
    id BIGSERIAL PRIMARY KEY,
    broadcast_kind TEXT NOT NULL DEFAULT 'manual',
    platform TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    user_id BIGINT,
    text TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
)
"""
BROADCAST_LOG_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_fredi_broadcast_log_kind_chat "
    "ON fredi_broadcast_log(broadcast_kind, chat_id, sent_at DESC)"
)


async def init_broadcast_table(db) -> None:
    async with db.get_connection() as conn:
        await conn.execute(BROADCAST_LOG_SQL)
        await conn.execute(BROADCAST_LOG_INDEX)


def _extract_max_chat_id(raw: str) -> str:
    """MAX chat_id в БД часто хранится как '<число>@<имя>' (формат из
    webhook). MAX API ожидает ТОЛЬКО числовую часть до '@'.

    Примеры:
      '256175731@Дмитрий' → '256175731'
      '266808266'         → '266808266'
    """
    if not raw:
        return ""
    s = str(raw).strip()
    if "@" in s:
        s = s.split("@", 1)[0].strip()
    return s


async def _tg_send_text(client: httpx.AsyncClient, chat_id: str, text: str) -> Tuple[bool, str]:
    if not TELEGRAM_TOKEN:
        return False, "TELEGRAM_TOKEN not set"
    try:
        r = await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            timeout=15.0,
        )
        if r.status_code == 200:
            return True, ""
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, str(e)


async def _max_send_text(client: httpx.AsyncClient, chat_id: str, text: str) -> Tuple[bool, str]:
    if not MAX_TOKEN:
        return False, "MAX_TOKEN not set"
    numeric_id = _extract_max_chat_id(chat_id)
    if not numeric_id:
        return False, f"bad chat_id (empty after split): {chat_id!r}"
    try:
        cid_int = int(numeric_id)
    except ValueError:
        return False, f"bad chat_id (not int): {numeric_id!r}"
    try:
        r = await client.post(
            "https://platform-api.max.ru/messages",
            params={"chat_id": cid_int, "access_token": MAX_TOKEN},
            json={"text": text},
            headers={"Authorization": MAX_TOKEN, "Content-Type": "application/json"},
            timeout=15.0,
        )
        if r.status_code == 200:
            return True, ""
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, str(e)


async def _max_upload_audio_once(audio_bytes: bytes) -> Tuple[str, str]:
    """Загружает MP3 в MAX uploads ОДИН раз → возвращает media_token.

    Этот token можно потом использовать в N attachments — один файл
    хостится у MAX, мы только ссылаемся при отправке N получателям.

    Returns: (media_token, error). error != '' если упало.
    """
    if not MAX_TOKEN:
        return "", "MAX_TOKEN not set"
    if not audio_bytes:
        return "", "empty audio_bytes"

    def _safe_json(r):
        try:
            return r.json()
        except Exception:
            return {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r1 = await client.get(
                "https://platform-api.max.ru/uploads",
                params={"type": "audio", "access_token": MAX_TOKEN},
            )
        except Exception as e:
            return "", f"uploads request: {e}"
        if r1.status_code != 200:
            return "", f"uploads HTTP {r1.status_code}: {r1.text[:200]}"
        upload_url = _safe_json(r1).get("url")
        if not upload_url:
            return "", f"no upload url: {r1.text[:200]!r}"

        try:
            r2 = await client.post(
                upload_url,
                files={"data": ("fredi-voice.mp3", audio_bytes, "audio/mpeg")},
            )
        except Exception as e:
            return "", f"upload request: {e}"
        if r2.status_code not in (200, 201):
            return "", f"upload HTTP {r2.status_code}: {r2.text[:200]}"
        resp = _safe_json(r2)
        media_token = (
            resp.get("token")
            or (resp.get("audio") or {}).get("token")
            or (resp.get("file") or {}).get("token")
        )
        if not media_token:
            return "", f"no media token: {r2.text[:200]!r}"

    logger.info(f"MAX uploaded audio: {len(audio_bytes)}b → token={str(media_token)[:16]}…")
    return str(media_token), ""


async def _max_send_audio_with_token(
    client: httpx.AsyncClient, chat_id: str, media_token: str, text: Optional[str] = None,
) -> Tuple[bool, str]:
    """Отправляет уже загруженный media_token в один MAX-чат."""
    if not MAX_TOKEN:
        return False, "MAX_TOKEN not set"
    numeric_id = _extract_max_chat_id(chat_id)
    try:
        cid_int = int(numeric_id)
    except (ValueError, TypeError):
        return False, f"bad chat_id: {chat_id!r}"
    payload: Dict[str, Any] = {
        "attachments": [{"type": "audio", "payload": {"token": media_token}}],
    }
    if text and text.strip():
        payload["text"] = text.strip()[:1000]
    try:
        r = await client.post(
            "https://platform-api.max.ru/messages",
            params={"chat_id": cid_int, "access_token": MAX_TOKEN},
            json=payload,
            headers={"Authorization": MAX_TOKEN, "Content-Type": "application/json"},
            timeout=15.0,
        )
        if r.status_code == 200:
            return True, ""
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, str(e)


async def _synthesize_voice(voice_text: str, mode: str = "psychologist") -> Tuple[bytes, str]:
    """TTS через Fish Audio. Returns (audio_bytes, error)."""
    if not voice_text or not voice_text.strip():
        return b"", "empty voice_text"
    try:
        from services.fish_audio_service import synthesize_fish_audio
    except Exception as e:
        return b"", f"fish_audio import: {e}"
    try:
        audio = await synthesize_fish_audio(voice_text.strip(), mode=mode)
        if not audio or len(audio) < 100:
            return b"", "TTS returned empty/short audio"
        return audio, ""
    except Exception as e:
        return b"", f"TTS failed: {e}"


async def _fetch_recipients(
    db, platform: str, target: str, user_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """Возвращает список получателей по фильтру.

    platform: 'max' | 'telegram'
    target:   'all' | 'last_7d' | 'last_30d' | 'specific'
    user_ids: используется когда target='specific'
    """
    args: List[Any] = [platform]
    sql = (
        "SELECT user_id, chat_id, username "
        "FROM fredi_messenger_links "
        "WHERE platform = $1 AND is_active = TRUE "
    )
    if target == "last_7d":
        sql += "AND linked_at > NOW() - INTERVAL '7 days' "
    elif target == "last_30d":
        sql += "AND linked_at > NOW() - INTERVAL '30 days' "
    elif target == "specific" and user_ids:
        args.append(user_ids)
        sql += f"AND user_id = ANY(${len(args)}::bigint[]) "
    sql += "ORDER BY linked_at DESC"

    async with db.get_connection() as conn:
        rows = await conn.fetch(sql, *args)
    return [
        {"user_id": int(r["user_id"]), "chat_id": r["chat_id"], "username": r["username"] or ""}
        for r in rows
    ]


async def broadcast(
    db,
    *,
    text: str,
    platform: str,                       # 'max' | 'telegram'
    target: str = "all",                 # 'all' | 'last_7d' | 'last_30d' | 'specific'
    user_ids: Optional[List[int]] = None,
    test_chat_id: Optional[str] = None,  # отправить ТОЛЬКО на этот chat_id (для проверки)
    broadcast_kind: str = "manual",
    cooldown_hours: int = 24,            # 0 = не проверять
    delay_sec: float = DEFAULT_DELAY_SEC,
    dry_run: bool = False,
    voice_text: Optional[str] = None,    # если задан и platform=='max' → TTS + аудио-аттач
    voice_mode: str = "psychologist",
) -> Dict[str, Any]:
    """Рассылка по mensenger-привязкам.

    Возвращает {sent, failed, skipped_cooldown, total, errors: [...]}.
    """
    if not text or not text.strip():
        return {"error": "empty_text", "message": "Текст пустой"}
    text = text.strip()
    if len(text) > 4000:
        return {"error": "text_too_long", "message": f"max 4000 символов (сейчас {len(text)})"}

    platform = (platform or "").strip().lower()
    if platform not in ("max", "telegram"):
        return {"error": "bad_platform", "message": "platform = max | telegram"}

    # --- Test mode: 1 chat_id, без БД ---
    if test_chat_id:
        if dry_run:
            return {
                "test_chat_id": test_chat_id, "dry_run": True,
                "would_send_to": 1, "text_preview": text[:200],
                "voice_planned": bool(voice_text and platform == "max"),
            }
        # Voice (MAX only): TTS + upload → token, отправка с аттачем
        media_token = ""
        audio_size = 0
        voice_err = ""
        if voice_text and platform == "max":
            audio, terr = await _synthesize_voice(voice_text, mode=voice_mode)
            if terr:
                voice_err = f"tts: {terr}"
            else:
                audio_size = len(audio)
                media_token, uerr = await _max_upload_audio_once(audio)
                if uerr:
                    voice_err = f"upload: {uerr}"
        async with httpx.AsyncClient() as client:
            if platform == "telegram":
                ok, err = await _tg_send_text(client, str(test_chat_id), text)
            elif media_token:
                ok, err = await _max_send_audio_with_token(
                    client, str(test_chat_id), media_token, text=text,
                )
            else:
                ok, err = await _max_send_text(client, str(test_chat_id), text)
        return {
            "test_chat_id": test_chat_id, "sent": 1 if ok else 0,
            "failed": 0 if ok else 1, "error": err if not ok else None,
            "voice_used": bool(media_token),
            "audio_size_bytes": audio_size,
            "voice_error": voice_err or None,
        }

    # --- Получатели ---
    recipients = await _fetch_recipients(db, platform, target, user_ids=user_ids)
    if not recipients:
        return {
            "sent": 0, "failed": 0, "skipped_cooldown": 0,
            "total": 0, "message": "Нет получателей под фильтр",
        }
    if len(recipients) > MAX_BROADCAST_SIZE:
        return {
            "error": "too_many_recipients",
            "message": f"max {MAX_BROADCAST_SIZE} получателей, найдено {len(recipients)}",
        }

    if dry_run:
        return {
            "dry_run": True,
            "would_send_to": len(recipients),
            "platform": platform,
            "target": target,
            "preview_recipients": recipients[:10],
            "text_preview": text[:200],
        }

    # --- Реальная отправка ---
    sent_count = 0
    failed = 0
    skipped_cooldown = 0
    errors: List[Dict[str, Any]] = []

    # Voice (MAX only): TTS + upload ОДИН раз — потом N attachments с одним token
    media_token = ""
    audio_size = 0
    voice_err = ""
    if voice_text and platform == "max":
        audio, terr = await _synthesize_voice(voice_text, mode=voice_mode)
        if terr:
            voice_err = f"tts: {terr}"
            logger.warning(f"broadcast voice TTS failed: {terr}")
        else:
            audio_size = len(audio)
            media_token, uerr = await _max_upload_audio_once(audio)
            if uerr:
                voice_err = f"upload: {uerr}"
                logger.warning(f"broadcast voice upload failed: {uerr}")
            else:
                logger.info(
                    f"broadcast voice ready: {audio_size}b, token={media_token[:16]}…, "
                    f"для {len(recipients)} получателей"
                )

    async with httpx.AsyncClient() as client:
        for rec in recipients:
            chat_id = rec["chat_id"]
            user_id = rec["user_id"]

            # Cooldown: не слать на тот же chat_id в том же broadcast_kind
            # последние cooldown_hours
            if cooldown_hours > 0:
                async with db.get_connection() as conn:
                    recent = await conn.fetchval(
                        "SELECT 1 FROM fredi_broadcast_log "
                        "WHERE broadcast_kind = $1 AND chat_id = $2 "
                        f"AND sent_at > NOW() - INTERVAL '{int(cooldown_hours)} hours' "
                        "AND status = 'sent' LIMIT 1",
                        broadcast_kind, str(chat_id),
                    )
                if recent:
                    skipped_cooldown += 1
                    continue

            # Send
            if platform == "telegram":
                ok, err = await _tg_send_text(client, str(chat_id), text)
            elif media_token:
                ok, err = await _max_send_audio_with_token(
                    client, str(chat_id), media_token, text=text,
                )
            else:
                ok, err = await _max_send_text(client, str(chat_id), text)

            # Log
            try:
                async with db.get_connection() as conn:
                    await conn.execute(
                        "INSERT INTO fredi_broadcast_log "
                        "(broadcast_kind, platform, chat_id, user_id, text, status, error_message) "
                        "VALUES ($1, $2, $3, $4, $5, $6, $7)",
                        broadcast_kind, platform, str(chat_id), user_id,
                        text[:4000], "sent" if ok else "error",
                        None if ok else err[:500],
                    )
            except Exception as _le:
                logger.warning(f"broadcast log write failed: {_le}")

            if ok:
                sent_count += 1
            else:
                failed += 1
                if len(errors) < 20:
                    errors.append({"user_id": user_id, "chat_id": chat_id, "error": err[:200]})

            # Rate-limit
            await asyncio.sleep(delay_sec)

    return {
        "platform": platform,
        "target": target,
        "total": len(recipients),
        "sent": sent_count,
        "failed": failed,
        "skipped_cooldown": skipped_cooldown,
        "errors": errors,
        "voice_used": bool(media_token),
        "audio_size_bytes": audio_size,
        "voice_error": voice_err or None,
    }
