"""
bot_service.py — Telegram + Max bot webhook handlers.
Handles /start web_{user_id} for account linking.
Registers webhook endpoints on the FastAPI app.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
MAX_TOKEN = os.environ.get("MAX_TOKEN", "")
BACKEND_URL = os.environ.get("API_URL", "https://fredi-backend-flz2.onrender.com")


def register_bot_webhooks(app, db):
    """Register /api/telegram/webhook and /api/max/webhook on FastAPI app."""

    # ================================================================
    # TELEGRAM WEBHOOK
    # ================================================================
    @app.post("/api/telegram/webhook")
    async def telegram_webhook(request):
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

            # Handle /start web_{user_id}
            if text.startswith("/start"):
                parts = text.split()
                if len(parts) >= 2 and parts[1].startswith("web_"):
                    web_user_id = parts[1].replace("web_", "")
                    try:
                        web_user_id_int = int(web_user_id)
                    except ValueError:
                        await _tg_send(chat_id, "Неверная ссылка привязки. Попробуйте ещё раз из настроек Фреди.")
                        return {"ok": True}

                    # Link accounts
                    async with db.get_connection() as conn:
                        # Ensure user exists
                        await conn.execute(
                            "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                            "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                            web_user_id_int
                        )
                        # Save link
                        await conn.execute("""
                            INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                            VALUES ($1, 'telegram', $2, $3, NOW(), TRUE)
                            ON CONFLICT (user_id, platform) DO UPDATE SET
                                chat_id = $2, username = $3, linked_at = NOW(), is_active = TRUE
                        """, web_user_id_int, chat_id, username or first_name)

                    display_name = username or first_name or "друг"
                    await _tg_send(chat_id, f"Привет, {display_name}! Аккаунт успешно привязан к Фреди. Теперь утренние сообщения будут приходить сюда.")
                    logger.info(f"Telegram linked: user {web_user_id} -> chat {chat_id}")
                else:
                    # Regular /start without deep link
                    await _tg_send(chat_id, "Привет! Я бот Фреди — виртуальный психолог.\n\nЧтобы привязать аккаунт, откройте Настройки в приложении Фреди и нажмите \"Связать аккаунт\" в разделе Telegram.")

            return {"ok": True}
        except Exception as e:
            logger.error(f"Telegram webhook error: {e}")
            return {"ok": True}

    # ================================================================
    # MAX WEBHOOK
    # ================================================================
    @app.post("/api/max/webhook")
    async def max_webhook(request):
        try:
            body = await request.json()

            # Max sends updates in different formats
            # Check for message_created event
            update_type = body.get("update_type", "")
            message = body.get("message", {})
            
            if update_type == "message_created" or message:
                msg_body = message.get("body", {})
                text = (msg_body.get("text") or "").strip() if isinstance(msg_body, dict) else ""
                
                # Also try top-level text
                if not text:
                    text = (body.get("text") or "").strip()
                
                chat_id = str(message.get("recipient", {}).get("chat_id", "") or body.get("chat_id", ""))
                sender = message.get("sender", {})
                sender_name = sender.get("name", "")
                user_id_max = str(sender.get("user_id", ""))

                if not chat_id:
                    chat_id = user_id_max

                if not text:
                    return {"ok": True}

                # Handle /start web_{user_id}
                if text.startswith("/start"):
                    parts = text.split()
                    if len(parts) >= 2 and parts[1].startswith("web_"):
                        web_user_id = parts[1].replace("web_", "")
                        try:
                            web_user_id_int = int(web_user_id)
                        except ValueError:
                            await _max_send(chat_id, "Неверная ссылка привязки. Попробуйте ещё раз из настроек Фреди.")
                            return {"ok": True}

                        # Link accounts
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

                        display_name = sender_name or "друг"
                        await _max_send(chat_id, f"Привет, {display_name}! Аккаунт успешно привязан к Фреди. Теперь утренние сообщения будут приходить сюда.")
                        logger.info(f"Max linked: user {web_user_id} -> chat {chat_id}")
                    else:
                        await _max_send(chat_id, "Привет! Я бот Фреди — виртуальный психолог.\n\nЧтобы привязать аккаунт, откройте Настройки в приложении Фреди и нажмите \"Связать аккаунт\" в разделе Max.")

            return {"ok": True}
        except Exception as e:
            logger.error(f"Max webhook error: {e}")
            return {"ok": True}

    # ================================================================
    # HELPER: Send message via Telegram
    # ================================================================
    async def _tg_send(chat_id, text):
        if not TELEGRAM_TOKEN:
            logger.warning("TELEGRAM_TOKEN not set")
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
                )
        except Exception as e:
            logger.error(f"Telegram send error: {e}")

    # ================================================================
    # HELPER: Send message via Max
    # ================================================================
    async def _max_send(chat_id, text):
        if not MAX_TOKEN:
            logger.warning("MAX_TOKEN not set")
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(
                    "https://platform-api.max.ru/messages",
                    json={"chat_id": chat_id, "text": text},
                    params={"access_token": MAX_TOKEN}
                )
        except Exception as e:
            logger.error(f"Max send error: {e}")

    # ================================================================
    # Setup webhooks on startup
    # ================================================================
    async def setup_bot_webhooks():
        """Register webhook URLs with Telegram and Max APIs."""
        webhook_base = BACKEND_URL.rstrip("/")

        # Telegram webhook
        if TELEGRAM_TOKEN:
            try:
                url = f"{webhook_base}/api/telegram/webhook"
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook",
                        json={"url": url}
                    )
                    result = resp.json()
                    if result.get("ok"):
                        logger.info(f"Telegram webhook set: {url}")
                    else:
                        logger.error(f"Telegram webhook failed: {result}")
            except Exception as e:
                logger.error(f"Telegram webhook setup error: {e}")
        else:
            logger.warning("TELEGRAM_TOKEN not set, skipping webhook")

        # Max webhook
        if MAX_TOKEN:
            try:
                url = f"{webhook_base}/api/max/webhook"
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        "https://platform-api.max.ru/subscriptions",
                        json={"url": url},
                        params={"access_token": MAX_TOKEN}
                    )
                    if resp.status_code in (200, 201):
                        logger.info(f"Max webhook set: {url}")
                    else:
                        logger.error(f"Max webhook failed: {resp.status_code} {resp.text}")
            except Exception as e:
                logger.error(f"Max webhook setup error: {e}")
        else:
            logger.warning("MAX_TOKEN not set, skipping webhook")

    return setup_bot_webhooks
