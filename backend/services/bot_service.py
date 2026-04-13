"""
bot_service.py — Telegram + Max bot webhook handlers.
Handles /start web_{user_id} for account linking.
Handles /start mirror_{code} for mirror test invites.
"""

import os
import json
import logging
import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
MAX_TOKEN = os.environ.get("MAX_TOKEN", "").strip()
BACKEND_URL = os.environ.get("API_URL", "https://fredi-backend-flz2.onrender.com").strip()
WEB_URL = os.environ.get("WEB_URL", "https://fredi-frontend.onrender.com").strip().rstrip("/")

MSG_LINK_SUCCESS = "Привет, {name}! Аккаунт успешно привязан к Фреди. Теперь утренние сообщения будут приходить сюда."
MSG_LINK_ERROR = "Неверная ссылка привязки. Попробуйте ещё раз из настроек Фреди."
MSG_START_TG = "Привет! Я бот Фреди — виртуальный психолог.\n\nЧтобы привязать аккаунт, откройте Настройки в приложении Фреди и нажмите «Связать аккаунт» в разделе Telegram."
MSG_START_MAX = "Привет! Я бот Фреди — виртуальный психолог.\n\nЧтобы привязать аккаунт, откройте Настройки в приложении Фреди и нажмите «Связать аккаунт» в разделе Max."
MSG_MIRROR_INVITE = "Привет! Тебя пригласили пройти психологический тест от Фреди.\n\n\u0001f449 {link}\n\n\u0023f1 Займёт 15 минут. Результат увидишь сразу!"


def register_bot_webhooks(app, db):

    @app.post("/api/telegram/webhook")
    async def telegram_webhook(request: Request):
        try:
            body = await request.json()
            message = body.get("message", {})
            if not message:
                return {"ok": True}

            chat_id = str(message.get("chat", {}).get("id", ""))
            text = (message.get("text") or "").strip()
            from_user = message.get("from", {})
            username = from_user.get("username", "")
            first_name = from_user.get("first_name", "")

            if not chat_id or not text:
                return {"ok": True}

            logger.info(f"TG webhook: chat={chat_id}, text={text[:50]}, user={username or first_name}")

            if text.startswith("/start"):
                parts = text.split()
                payload = parts[1] if len(parts) >= 2 else ""

                if payload.startswith("web_"):
                    web_user_id = payload.replace("web_", "")
                    try:
                        web_user_id_int = int(web_user_id)
                    except ValueError:
                        await _tg_send(chat_id, MSG_LINK_ERROR)
                        return {"ok": True}

                    async with db.get_connection() as conn:
                        await conn.execute(
                            "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                            "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                            web_user_id_int
                        )
                        await conn.execute("""
                            INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                            VALUES ($1, 'telegram', $2, $3, NOW(), TRUE)
                            ON CONFLICT (user_id, platform) DO UPDATE SET
                                chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                        """, web_user_id_int, chat_id, username or first_name)

                    await _tg_send(chat_id, MSG_LINK_SUCCESS.format(name=username or first_name or "друг"))
                    logger.info(f"Telegram linked: user {web_user_id} -> chat {chat_id}")

                elif payload.startswith("mirror_"):
                    # Сохраняем friend_user_id и имя в БД сразу
                    tg_user_id = from_user.get("id")
                    if tg_user_id:
                        async with db.get_connection() as conn:
                            await conn.execute(
                                "UPDATE fredi_mirrors SET friend_user_id = $1, friend_name = $2 "
                                "WHERE mirror_code = $3 AND status = 'active'",
                                int(tg_user_id), first_name or username or "Друг", payload
                            )
                        logger.info(f"🪞 TG mirror friend saved: {payload} -> friend {tg_user_id} ({first_name})")
                    await _tg_send(chat_id, MSG_START_TG)
                    logger.info(f"Telegram mirror invite sent: {payload} -> chat {chat_id}")

                else:
                    await _tg_send(chat_id, MSG_START_TG)

            return {"ok": True}
        except Exception as e:
            logger.error(f"Telegram webhook error: {e}")
            return {"ok": True}

    @app.post("/api/max/webhook")
    async def max_webhook(request: Request):
        try:
            body = await request.json()
            logger.info(f"MAX webhook raw: {json.dumps(body, ensure_ascii=False)[:500]}")

            update_type = body.get("update_type", "")

            if update_type == "message_created":
                message = body.get("message", {})
                msg_body = message.get("body", {})
                text = ""

                if isinstance(msg_body, dict):
                    text = (msg_body.get("text") or "").strip()
                elif isinstance(msg_body, str):
                    text = msg_body.strip()

                sender = message.get("sender", {})
                sender_name = sender.get("name", "")
                sender_user_id = str(sender.get("user_id", ""))

                recipient = message.get("recipient", {})
                chat_id = str(recipient.get("chat_id", ""))

                if not chat_id:
                    chat_id = str(message.get("chat_id", ""))
                if not chat_id:
                    chat_id = sender_user_id

                logger.info(f"MAX parsed: chat_id={chat_id}, text={text[:50]}, sender={sender_name}, sender_id={sender_user_id}")

                if not text:
                    return {"ok": True}

                if text.startswith("/start"):
                    parts = text.split()
                    payload = parts[1] if len(parts) >= 2 else ""

                    if payload.startswith("web_"):
                        web_user_id = payload.replace("web_", "")
                        try:
                            web_user_id_int = int(web_user_id)
                        except ValueError:
                            await _max_send(chat_id, MSG_LINK_ERROR)
                            return {"ok": True}

                        async with db.get_connection() as conn:
                            await conn.execute(
                                "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                                "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                                web_user_id_int
                            )
                            await conn.execute("""
                                INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                                VALUES ($1, 'max', $2, $3, NOW(), TRUE)
                                ON CONFLICT (user_id, platform) DO UPDATE SET
                                    chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                            """, web_user_id_int, chat_id, sender_name)

                        await _max_send(chat_id, MSG_LINK_SUCCESS.format(name=sender_name or "друг"))
                        logger.info(f"Max linked: user {web_user_id} -> chat {chat_id}")

                    elif payload.startswith("mirror_"):
                        link = f"{WEB_URL}?ref={payload}"
                        await _max_send(chat_id, f"Привет! Тебя пригласили пройти психологический тест от Фреди.\n\n\ud83d\udc49 {link}\n\n\u23f1 Займёт 15 минут. Результат увидишь сразу!")
                        logger.info(f"Max mirror invite sent: {payload} -> chat {chat_id}")

                    else:
                        await _max_send(chat_id, MSG_START_MAX)

            elif update_type == "bot_started":
                user = body.get("user", {})
                chat_id = str(body.get("chat_id", ""))
                user_name = user.get("name", "")
                logger.info(f"MAX bot_started: chat_id={chat_id}, user={user_name}")

                payload = body.get("payload", "") or ""

                if payload.startswith("web_"):
                    web_user_id = payload.replace("web_", "")
                    try:
                        web_user_id_int = int(web_user_id)
                        async with db.get_connection() as conn:
                            await conn.execute(
                                "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                                "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                                web_user_id_int
                            )
                            await conn.execute("""
                                INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                                VALUES ($1, 'max', $2, $3, NOW(), TRUE)
                                ON CONFLICT (user_id, platform) DO UPDATE SET
                                    chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                            """, web_user_id_int, chat_id, user_name)
                        await _max_send(chat_id, MSG_LINK_SUCCESS.format(name=user_name or "друг"))
                        logger.info(f"Max linked via bot_started: user {web_user_id} -> chat {chat_id}")
                    except ValueError:
                        await _max_send(chat_id, MSG_START_MAX)

                elif payload.startswith("mirror_"):
                    friend_uid = user.get("user_id")
                    if friend_uid:
                        async with db.get_connection() as conn:
                            await conn.execute(
                                "UPDATE fredi_mirrors SET friend_user_id = $1, friend_name = $2 "
                                "WHERE mirror_code = $3 AND status = 'active'",
                                int(friend_uid), user_name or "Друг", payload
                            )
                        logger.info(f"🪞 Mirror friend saved: {payload} -> friend {friend_uid} ({user_name})")
                    await _max_send(chat_id, MSG_START_MAX)

                else:
                    await _max_send(chat_id, MSG_START_MAX)
            else:
                logger.info(f"MAX webhook unknown update_type: {update_type}")

            return {"ok": True}
        except Exception as e:
            logger.error(f"Max webhook error: {e}", exc_info=True)
            return {"ok": True}

    async def _tg_send(chat_id, text):
        if not TELEGRAM_TOKEN:
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                    json={"chat_id": chat_id, "text": text}
                )
                logger.info(f"TG send: {resp.status_code}")
        except Exception as e:
            logger.error(f"Telegram send error: {e}")

    async def _max_send(chat_id, text):
        if not MAX_TOKEN:
            logger.warning("MAX_TOKEN not set, can't send")
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                payload = {"text": text}
                url = f"https://platform-api.max.ru/messages?chat_id={chat_id}"
                resp = await client.post(
                    url,
                    json=payload,
                    headers={"Authorization": MAX_TOKEN, "Content-Type": "application/json"}
                )
                logger.info(f"MAX send to {chat_id}: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Max send error: {e}")

    async def setup_bot_webhooks():
        webhook_base = BACKEND_URL.strip().rstrip("/")
        logger.info(f"Bot webhook base URL: [{webhook_base}]")

        if TELEGRAM_TOKEN:
            try:
                url = f"{webhook_base}/api/telegram/webhook"
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook",
                        json={"url": url, "allowed_updates": ["message"]}
                    )
                    result = resp.json()
                    if result.get("ok"):
                        logger.info(f"Telegram webhook set OK")
                    else:
                        logger.error(f"Telegram webhook failed: {result}")
            except Exception as e:
                logger.error(f"Telegram webhook setup error: {e}")

        if MAX_TOKEN:
            try:
                url = f"{webhook_base}/api/max/webhook"
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        "https://platform-api.max.ru/subscriptions",
                        json={"url": url, "update_types": ["message_created", "bot_started"]},
                        headers={"Authorization": MAX_TOKEN}
                    )
                    if resp.status_code in (200, 201):
                        logger.info(f"Max webhook set OK")
                    else:
                        logger.error(f"Max webhook failed: {resp.status_code} {resp.text[:200]}")
            except Exception as e:
                logger.error(f"Max webhook setup error: {e}")

    return setup_bot_webhooks
