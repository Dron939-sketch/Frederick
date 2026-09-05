"""
reengagement.py — кампании возврата для пользователей, которые
зашли и не вернулись.

Phase 1: одна кампания «d3_first».
- Триггер: создан > 3 дня назад, last_activity > 3 дня назад,
  но не более 14 дней (давно ушедших не трогаем),
  email_opted_in = TRUE, email NOT NULL,
  ещё не отправляли это сообщение.
- Контекст для AI — только поведенческий: какие экраны открывал,
  дошёл ли до теста, какой архетип, есть ли активный план навыка.
  СОДЕРЖАНИЕ диалогов с Фреди НЕ читаем (этический выбор).
- Канал: MAX, если привязан, иначе email.
- Дедуп: уникальный (user_id, campaign) в fredi_reengagement_log.
- Opt-out: каждое сообщение содержит ссылку «один клик», обновляющую
  email_opted_in в FALSE.

Шедулер запускается в main.py как asyncio-task, тикает раз в час.
"""
from __future__ import annotations
import asyncio
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Базовые URL'ы для ссылок в сообщениях. APP_BASE_URL = web-фронт,
# куда мы кликаем «вернуться». API_BASE_URL = бэк, куда летят
# /optout и /track.
APP_BASE_URL = (os.environ.get("APP_BASE_URL")
                or "https://meysternlp.ru/fredi/").rstrip("/") + "/"
# Дефолт — same-origin через nginx meysternlp (/api/ проксируется на бэкенд).
# Раньше здесь стоял мёртвый onrender-адрес (отвечает 503): ни API_BASE_URL,
# ни PUBLIC_API_BASE_URL в проде не заданы, и каждая ссылка «отписаться»
# в письмах вела бы в никуда.
API_BASE_URL = (os.environ.get("API_BASE_URL")
                or os.environ.get("PUBLIC_API_BASE_URL")
                or "https://meysternlp.ru").rstrip("/")

# Кампания «d3» — первое и единственное в Phase 1.
CAMPAIGN_D3 = "d3_first"

# Кампания «trial_spent» (Phase 2): пользователь выговорил бесплатные
# минуты, подписки нет. Самый горячий момент воронки: человек уже знает,
# что такое разговор с Фреди, и упёрся в счётчик. Текст фиксированный —
# в платёжном письме генерации не место: каждое слово должно быть
# проверяемым (цена, условия).
CAMPAIGN_TRIAL = "trial_spent"

# Кампания «d1» (05.09.2026): «Фреди напишет завтра». Выгрузка диалогов
# за месяц показала, что все длинные разговоры обрываются на реплике
# Фреди и повода вернуться нет, а подписка покупается на второй-третий
# день. Через сутки после разговора — короткое письмо с продолжением его
# темы: «как прошло?», один шаг, дверь обратно. Не реклама. В отличие от
# d3, письмо знает тему последней реплики (решение владельца): без цитат,
# только суть в двух-трёх словах.
CAMPAIGN_D1 = "d1_tomorrow"
D1_SUBJECT = "Фреди: как прошло?"


# ============================================================
# 1. ПОВЕДЕНЧЕСКОЕ SUMMARY
# ============================================================

async def build_user_summary(db, user_id: int) -> dict:
    """Собирает поведенческий summary за последние 7 дней.

    Принципиально НЕ читает содержание сообщений с Фреди — только
    события из fredi_analytics + статусы из fredi_users / fredi_skill_plans.
    Это защита от ощущения слежки в reengagement-сообщениях.
    """
    # Профиль юзера
    # Имя человека живёт в fredi_user_contexts.name (то, что он сам назвал
    # Фреди); в fredi_users колонки name нет — берём с фолбэком на first_name.
    user = await db.fetchrow(
        """SELECT u.user_id,
                  COALESCE(uc.name, u.first_name) AS name,
                  u.email, u.created_at, u.last_activity
           FROM fredi_users u
           LEFT JOIN fredi_user_contexts uc ON uc.user_id = u.user_id
           WHERE u.user_id = $1""",
        user_id
    )
    if not user:
        return {}

    now = datetime.now(timezone.utc)
    days_since_signup = (now - user['created_at']).days if user['created_at'] else 0
    days_inactive = (now - user['last_activity']).days if user['last_activity'] else 0

    # События последних 7 дней — компактно (LIMIT 200, нам нужны только
    # топ-категории, не вся история).
    rows = await db.fetch(
        """SELECT event, screen, data
           FROM fredi_analytics
           WHERE user_id = $1
             AND created_at > NOW() - INTERVAL '7 days'
           ORDER BY id DESC LIMIT 200""",
        user_id
    )

    screens, features = {}, {}
    test_completed = False
    test_archetype = None
    last_screen = None

    for r in rows:
        ev = r['event']
        d = r['data'] or {}
        if ev == 'screen_view':
            s = d.get('screen') or r['screen']
            if s:
                screens[s] = screens.get(s, 0) + 1
                if not last_screen:
                    last_screen = s
        elif ev == 'feature_opened':
            f = d.get('feature') or r['screen']
            if f:
                features[f] = features.get(f, 0) + 1
        elif ev == 'test_completed':
            test_completed = True
            test_archetype = d.get('archetype') or test_archetype

    # Активный план развития навыка (если стартовал)
    skill_active = None
    plan = await db.fetchrow(
        """SELECT skill_name, started_at, days_done
           FROM fredi_skill_plans WHERE user_id = $1""",
        user_id
    )
    if plan and plan['skill_name']:
        skill_active = {
            'name': plan['skill_name'],
            'days_done': len(plan['days_done'] or []) if plan['days_done'] else 0,
        }

    # MAX-привязка — для выбора канала
    max_link = await db.fetchrow(
        """SELECT chat_id FROM fredi_messenger_links
           WHERE user_id = $1 AND platform = 'max' LIMIT 1""",
        user_id
    )

    return {
        'user_id': user_id,
        'name': user['name'] or '',
        'email': user['email'] or '',
        'days_since_signup': days_since_signup,
        'days_inactive': days_inactive,
        'top_screens': sorted(screens.items(), key=lambda x: -x[1])[:3],
        'top_features': sorted(features.items(), key=lambda x: -x[1])[:3],
        'last_screen': last_screen,
        'test_completed': test_completed,
        'test_archetype': test_archetype,
        'skill_active': skill_active,
        'has_max': bool(max_link),
        'max_chat_id': max_link['chat_id'] if max_link else None,
    }


# ============================================================
# 2. AI-ГЕНЕРАЦИЯ ТЕКСТА
# ============================================================

def _facts_block(s: dict) -> str:
    """Форматирует поведенческие факты для промпта."""
    facts = []
    if s.get('test_completed'):
        arch = s.get('test_archetype') or 'неизвестен'
        facts.append(f"прошёл психологический тест (архетип: {arch})")
    elif s.get('top_screens') and any(scr == 'test' for scr, _ in s['top_screens']):
        facts.append("начал психологический тест, но не дошёл до конца")

    if s.get('skill_active'):
        sk = s['skill_active']
        facts.append(f"начал план развития навыка «{sk['name']}», прошёл {sk['days_done']}/21 дней")

    if s.get('top_features'):
        names = [f for f, _ in s['top_features']]
        if names:
            facts.append("чаще всего открывал: " + ", ".join(names))

    if not facts:
        facts.append("заходил несколько раз, но почти ничего не пробовал")
    return "\n- " + "\n- ".join(facts)


async def generate_message_text(s: dict) -> str:
    """Просит Claude (sonnet по умолчанию) написать короткое
    персональное письмо возврата. Падает в фолбэк-шаблон, если
    LLM не отвечает или env не настроен."""
    name = (s.get('name') or 'друг').strip() or 'друг'
    facts = _facts_block(s)
    days = s.get('days_inactive') or 3

    prompt = (
        "Ты — Фреди, виртуальный психолог. Напиши короткое (60-100 слов) "
        "персональное сообщение для возврата пользователя на платформу.\n\n"
        f"Имя: {name}\n"
        f"Дней с последнего визита: {days}\n"
        f"Что делал на платформе:{facts}\n\n"
        "Тон: тёплый, искренний, без давления. Не «вернись срочно», "
        "а «подумалось о тебе».\n"
        "Зацепка — на основе того, на чём остановился. БЕЗ цитат "
        "и без упоминания содержания диалогов.\n"
        "Заверши приглашением вернуться — короткой фразой. Без "
        "CTA-кнопок (ссылка добавится отдельно). Без подписи в конце. "
        "Начни сразу, без приветствия."
    )

    try:
        # Claude, если включён USE_ANTHROPIC (call_anthropic вернёт None при
        # выключенном флаге); иначе и при пустом ответе — DeepSeek. Только если
        # обе модели молчат, отдаём шаблон.
        from services.anthropic_client import call_anthropic
        text = await call_anthropic(prompt, max_tokens=300, temperature=0.7)
        if not (text and isinstance(text, str) and len(text.strip()) > 30):
            from services.ai_service import call_deepseek
            text = await call_deepseek(prompt, max_tokens=300, temperature=0.7)
        if text and isinstance(text, str) and len(text.strip()) > 30:
            return text.strip()
    except Exception as e:
        logger.warning(f"[reeng] LLM call failed: {e}")

    return _fallback_text(name, s)


async def _last_user_topic(db, user_id: int) -> str:
    """Последняя реплика человека (обрезанная) — для письма d1."""
    try:
        row = await db.fetchrow(
            """SELECT content FROM fredi_messages
               WHERE user_id = $1 AND role = 'user'
               ORDER BY id DESC LIMIT 1""", user_id)
        return (row['content'] or '').strip()[:400] if row else ''
    except Exception as e:
        logger.warning(f"[reeng] last topic failed: {e}")
        return ''


async def generate_d1_text(s: dict, topic: str) -> str:
    """Письмо на следующий день: продолжение вчерашнего разговора."""
    name = (s.get('name') or 'друг').strip() or 'друг'
    prompt = (
        "Ты — Фреди, виртуальный психолог. Вчера человек говорил с тобой, "
        "разговор оборвался. Напиши ему короткое письмо (40–70 слов), как "
        "будто продолжаешь тот же разговор на следующий день.\n\n"
        f"Имя: {name}\n"
        f"О чём была его последняя реплика (не цитируй, назови суть двумя-тремя словами): {topic or 'не известно'}\n\n"
        "Строение: спроси, как прошло вчера или как сегодня с этим; одно "
        "наблюдение по теме; один маленький шаг на сегодня; фраза-приглашение "
        "продолжить. Тон спокойный, на «ты», без восклицаний, без «всё будет "
        "хорошо», без рекламы, без упоминания подписки и минут. Без "
        "приветствия и без подписи. Не пересказывай, что он говорил."
    )
    try:
        from services.anthropic_client import call_anthropic
        text = await call_anthropic(prompt, max_tokens=260, temperature=0.7)
        if not (text and isinstance(text, str) and len(text.strip()) > 30):
            from services.ai_service import call_deepseek
            text = await call_deepseek(prompt, max_tokens=260, temperature=0.7)
        if text and isinstance(text, str) and len(text.strip()) > 30:
            return text.strip()
    except Exception as e:
        logger.warning(f"[reeng] d1 LLM call failed: {e}")
    return (f"{name}, вчера мы остановились на полуслове. Как прошло? "
            f"Если хочешь, продолжим с того же места — я помню, о чём шла речь.")


def _fallback_text(name: str, s: dict) -> str:
    """Шаблонное сообщение, если LLM недоступна."""
    if s.get('skill_active'):
        sk = s['skill_active']
        return (
            f"{name}, твой план «{sk['name']}» ждёт — на дне {sk['days_done'] + 1}. "
            "Если получится сегодня уделить 5 минут, дальше станет легче. "
            "Возвращайся, когда будешь готов."
        )
    if s.get('test_completed'):
        return (
            f"{name}, ты прошёл тест и узнал свой архетип — это первый слой. "
            "Дальше можем разобрать, как этот паттерн проявляется в твоих "
            "сегодняшних задачах. Заходи, когда будет время."
        )
    return (
        f"{name}, заходи, когда захочется. Я здесь, когда понадобится "
        "разобрать что-то изнутри — мысль, состояние, ситуацию. Без давления."
    )


def _trial_text(s: dict) -> str:
    """Текст письма trial_spent. Без генерации: цена и условия — только
    проверяемые. 990 ₽/мес и безлимит по минутам — из subscription_meter
    (премиуму remaining_minutes = None) и страницы тарифов.

    04.09 переписано под возобновляемые лимиты (#618). Прежний текст
    («вы использовали бесплатные минуты… дальше по подписке») при новой
    модели врал: кандидат — тот, кто выговорил окно «всё включено»
    (≥ 9 из 10 минут), но его текстовые минуты обновляются каждый день
    и не кончаются насовсем. Письмо, обещающее человеку стену, которой
    нет, — худшее из возможных: он не вернётся, потому что «всё равно
    платно». Числа берём из subscription_meter, не вписываем руками:
    кандидаты все с почтой, значит — дневной лимит аккаунта."""
    from subscription_meter import FREE_DAILY_MINUTES
    name = (s.get('name') or '').strip()
    hello = f"{name}, вы" if name else "Вы"
    return (
        f"{hello} попробовали Фреди не мимоходом — спасибо: окно "
        "знакомства с голосом и всеми режимами выговорено.\n\n"
        f"Текстом разговор продолжается бесплатно каждый день: "
        f"{FREE_DAILY_MINUTES} минут в сутки, счётчик обновляется в полночь. "
        "Фреди помнит, где вы остановились, — можно продолжить с того же места.\n\n"
        "Если хочется без счётчика и с голосом — подписка: 990 ₽ в месяц, "
        "говорите столько, сколько нужно. Если пока не время — ничего не "
        "потеряется: история и профиль остаются."
    )


TRIAL_SUBJECT = "Фреди: бесплатные минуты вернулись — можно продолжить"


# ============================================================
# 3. ОТПРАВКА
# ============================================================

async def _send_via_max(chat_id: str, text: str, return_link: str) -> bool:
    """Шлёт сообщение в MAX. Использует тот же endpoint, что
    skill_notify.send_max — но с другим текстом и без attachments."""
    import aiohttp
    token = (os.environ.get("MAX_TOKEN") or "").strip()
    if not token or not chat_id:
        return False
    url = "https://platform-api.max.ru/messages"
    headers = {"Authorization": token, "Content-Type": "application/json"}
    body = {
        "text": text,
        "format": "markdown",
        "notify": True,
        "attachments": [{
            "type": "inline_keyboard",
            "payload": {
                "buttons": [[{
                    "type": "link",
                    "text": "🔗 Открыть Фреди",
                    "url": return_link,
                }]]
            }
        }]
    }
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as sess:
            async with sess.post(url + f"?chat_id={chat_id}",
                                 json=body, headers=headers) as r:
                ok = r.status == 200
                if not ok:
                    txt = await r.text()
                    logger.warning(f"[reeng] MAX send failed: {r.status} {txt[:200]}")
                return ok
    except Exception as e:
        logger.warning(f"[reeng] MAX send exception: {e}")
        return False


async def _send_via_email(email_service, to: str, subject: str,
                           text_body: str, html_body: str) -> bool:
    if not email_service or not getattr(email_service, "enabled", False):
        return False
    try:
        return await email_service.send(to=to, subject=subject,
                                         body=text_body, html=html_body)
    except Exception as e:
        logger.warning(f"[reeng] email send exception: {e}")
        return False


def _build_html(text: str, return_link: str, optout_link: str) -> str:
    """Простой HTML-вариант для email-клиентов."""
    safe_text = (text or "").replace("\n", "<br>")
    return f"""<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:24px auto;padding:0 16px;color:#1c1c1e;line-height:1.55">
<p>{safe_text}</p>
<p style="margin-top:24px">
  <a href="{return_link}" style="display:inline-block;padding:12px 22px;background:#1c1c1e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Открыть Фреди</a>
</p>
<hr style="margin-top:36px;border:none;border-top:1px solid #e5e5ea">
<p style="font-size:12px;color:#8e8e93;margin-top:14px">
  Если такие письма больше не нужны — <a href="{optout_link}" style="color:#8e8e93">отписаться в один клик</a>.
</p>
</body></html>"""


async def send_reengagement(db, email_service, user_id: int,
                             campaign: str = CAMPAIGN_D3) -> bool:
    """Главная функция отправки. Возвращает True, если хотя бы
    один канал доставил.

    INSERT-first защита от гонки: сначала пробуем застолбить запись
    в fredi_reengagement_log с placeholder text и delivered=FALSE.
    Если ON CONFLICT DO NOTHING сработал (запись уже есть) — выходим
    без отправки. Так два параллельных вызова (например, оператор
    дважды быстро кликнул «Отправить всем») не дублируют сообщение.
    После успешной отправки — UPDATE с реальным текстом и delivered.
    """
    s = await build_user_summary(db, user_id)
    if not s or not s.get('email'):
        return False

    token = secrets.token_urlsafe(20)
    channel = 'max' if s.get('has_max') else 'email'

    inserted = await db.fetchrow(
        """INSERT INTO fredi_reengagement_log
            (user_id, campaign, channel, message_text, delivered, opt_out_token, sent_at)
           VALUES ($1, $2, $3, '', FALSE, $4, NOW())
           ON CONFLICT (user_id, campaign) DO NOTHING
           RETURNING id""",
        user_id, campaign, channel, token
    )
    if not inserted:
        # Запись уже есть — кампания этому юзеру отправлялась.
        # Параллельный процесс уже её обрабатывает (или обработал).
        logger.info(f"[reeng] {campaign} already logged for user {user_id} — skip")
        return False
    log_id = inserted['id']

    return_link = f"{APP_BASE_URL}?ref=reeng&cid={token}"
    optout_link = f"{API_BASE_URL}/api/reengagement/optout?t={token}"

    if campaign == CAMPAIGN_TRIAL:
        text = _trial_text(s)
        subject = TRIAL_SUBJECT
        return_link = f"{APP_BASE_URL}?ref=reeng-trial&cid={token}"
    elif campaign == CAMPAIGN_D1:
        text = await generate_d1_text(s, await _last_user_topic(db, user_id))
        subject = D1_SUBJECT
        return_link = f"{APP_BASE_URL}?ref=reeng-d1&cid={token}"
    else:
        text = await generate_message_text(s)
        subject = "Фреди — подумалось о тебе"
    delivered = False

    if channel == 'max':
        max_text = (
            f"{text}\n\n"
            f"<sub>Если такие сообщения не нужны — [отписаться]({optout_link}).</sub>"
        )
        delivered = await _send_via_max(s['max_chat_id'], max_text, return_link)
        if not delivered:
            # MAX-фолбэк → email. Меняем зафиксированный канал.
            channel = 'email'
            delivered = await _send_via_email(
                email_service, s['email'],
                subject,
                f"{text}\n\nОткрыть Фреди: {return_link}\n\n"
                f"Не хочешь получать такие письма? {optout_link}",
                _build_html(text, return_link, optout_link)
            )
    else:
        delivered = await _send_via_email(
            email_service, s['email'],
            subject,
            f"{text}\n\nОткрыть Фреди: {return_link}\n\n"
            f"Не хочешь получать такие письма? {optout_link}",
            _build_html(text, return_link, optout_link)
        )

    # Дописываем реальный результат в зафиксированную ранее строку.
    await db.execute(
        """UPDATE fredi_reengagement_log
           SET message_text = $1, delivered = $2, channel = $3
           WHERE id = $4""",
        text, delivered, channel, log_id
    )
    return delivered


# ============================================================
# 4. SCHEDULER
# ============================================================

async def _scan_and_send_d3(db, email_service):
    """Один проход: ищем кандидатов на d3 и отправляем."""
    rows = await db.fetch(
        """SELECT u.user_id
           FROM fredi_users u
           WHERE u.created_at < NOW() - INTERVAL '3 days'
             AND u.last_activity < NOW() - INTERVAL '3 days'
             AND u.last_activity > NOW() - INTERVAL '14 days'
             AND u.email IS NOT NULL
             AND COALESCE(u.email_opted_in, TRUE) = TRUE
             AND NOT EXISTS (
                 SELECT 1 FROM fredi_reengagement_log l
                 WHERE l.user_id = u.user_id AND l.campaign = $1
             )
           LIMIT 50""",
        CAMPAIGN_D3
    )

    if not rows:
        return

    logger.info(f"[reeng] d3: найдено {len(rows)} кандидатов")
    for r in rows:
        try:
            await send_reengagement(db, email_service, r['user_id'], CAMPAIGN_D3)
        except Exception as e:
            logger.warning(f"[reeng] send failed for user {r['user_id']}: {e}")
        # Мягкий rate-limit: не больше ~50/мин = вполне для SMTP-провайдеров.
        await asyncio.sleep(1.2)


async def _scan_and_send_trial(db, email_service):
    """Один проход по кандидатам trial_spent.

    Кандидат: зарегистрирован (email есть, от писем не отказывался),
    выговорил ≥ 9 из 10 бесплатных минут (total_usage_seconds ≥ 540 —
    берём с запасом, чтобы поймать и тех, кто упёрся в счётчик на
    последних секундах), активной подписки нет, последний визит от
    12 часов до 14 дней назад: в моменте не дёргаем, давно ушедших
    не трогаем."""
    rows = await db.fetch(
        """SELECT u.user_id
           FROM fredi_users u
           WHERE u.email IS NOT NULL
             AND COALESCE(u.email_opted_in, TRUE) = TRUE
             AND COALESCE(u.total_usage_seconds, 0) >= 540
             AND u.last_activity < NOW() - INTERVAL '12 hours'
             AND u.last_activity > NOW() - INTERVAL '14 days'
             AND NOT EXISTS (
                 SELECT 1 FROM fredi_subscriptions sub
                 WHERE sub.user_id = u.user_id
                   AND sub.status = 'active' AND sub.expires_at > NOW()
             )
             AND NOT EXISTS (
                 SELECT 1 FROM fredi_reengagement_log l
                 WHERE l.user_id = u.user_id AND l.campaign = $1
             )
           LIMIT 50""",
        CAMPAIGN_TRIAL
    )
    if not rows:
        return
    logger.info(f"[reeng] trial_spent: найдено {len(rows)} кандидатов")
    for r in rows:
        try:
            await send_reengagement(db, email_service, r['user_id'], CAMPAIGN_TRIAL)
        except Exception as e:
            logger.warning(f"[reeng] trial send failed for user {r['user_id']}: {e}")
        await asyncio.sleep(1.2)


D1_SQL = """SELECT u.user_id
             FROM fredi_users u
            WHERE u.email IS NOT NULL AND u.email <> ''
              AND u.last_activity < NOW() - INTERVAL '20 hours'
              AND u.last_activity > NOW() - INTERVAL '40 hours'
              AND EXISTS (SELECT 1 FROM fredi_messages m
                           WHERE m.user_id = u.user_id AND m.role = 'user'
                             AND m.created_at > NOW() - INTERVAL '2 days')
              AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                               WHERE l.user_id = u.user_id AND l.campaign = $1)
              AND u.email_opted_out_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM fredi_reengagement_log l
                               WHERE l.user_id = u.user_id AND l.opted_out_at IS NOT NULL)
            LIMIT 50"""


async def _scan_and_send_d1(db, email_service):
    """Один проход d1: разговор был сутки назад, письма ещё не было."""
    rows = await db.fetch(D1_SQL, CAMPAIGN_D1)
    logger.info(f"[reeng] d1: найдено {len(rows)} кандидатов")
    for r in rows:
        try:
            await send_reengagement(db, email_service, r['user_id'], CAMPAIGN_D1)
        except Exception as e:
            logger.warning(f"[reeng] d1 send failed for user {r['user_id']}: {e}")


async def _count_d1_candidates(db) -> int:
    rows = await db.fetch(D1_SQL, CAMPAIGN_D1)
    return len(rows)


async def _count_trial_candidates(db) -> int:
    """COUNT кандидатов trial_spent — для логов и админки."""
    row = await db.fetchrow(
        """SELECT COUNT(*)::int AS n
           FROM fredi_users u
           WHERE u.email IS NOT NULL
             AND COALESCE(u.email_opted_in, TRUE) = TRUE
             AND COALESCE(u.total_usage_seconds, 0) >= 540
             AND u.last_activity < NOW() - INTERVAL '12 hours'
             AND u.last_activity > NOW() - INTERVAL '14 days'
             AND NOT EXISTS (
                 SELECT 1 FROM fredi_subscriptions sub
                 WHERE sub.user_id = u.user_id
                   AND sub.status = 'active' AND sub.expires_at > NOW()
             )
             AND NOT EXISTS (
                 SELECT 1 FROM fredi_reengagement_log l
                 WHERE l.user_id = u.user_id AND l.campaign = $1
             )""",
        CAMPAIGN_TRIAL
    )
    return int(row["n"] if row else 0)


async def _count_candidates(db) -> int:
    """Дешёвый COUNT — для логов и polling из админки."""
    row = await db.fetchrow(
        """SELECT COUNT(*)::int AS n
           FROM fredi_users u
           WHERE u.created_at < NOW() - INTERVAL '3 days'
             AND u.last_activity < NOW() - INTERVAL '3 days'
             AND u.last_activity > NOW() - INTERVAL '14 days'
             AND u.email IS NOT NULL
             AND COALESCE(u.email_opted_in, TRUE) = TRUE
             AND NOT EXISTS (
                 SELECT 1 FROM fredi_reengagement_log l
                 WHERE l.user_id = u.user_id AND l.campaign = $1
             )""",
        CAMPAIGN_D3
    )
    return int(row["n"] if row else 0)


async def reengagement_scheduler(db, email_service_getter):
    """Бэкграунд-loop: раз в час считаем кандидатов и (опционально) шлём.

    Полу-автомат: по умолчанию REENG_AUTOSEND=0 — шедулер ничего не
    отправляет, только логирует количество кандидатов. Оператор
    смотрит число в админке и нажимает кнопку «Отправить».

    Полностью автоматический режим включается env REENG_AUTOSEND=1 —
    тогда каждый час шлём batch до 50.
    """
    autosend = (os.environ.get("REENG_AUTOSEND") or "0").strip() == "1"
    if autosend:
        logger.info("[reeng] AUTOSEND=1 — режим полностью автоматический")
    else:
        logger.info("[reeng] AUTOSEND=0 — полу-автомат: шлём только из админки")

    # Стартовая пауза — даём приложению полностью подняться.
    await asyncio.sleep(60)
    while True:
        try:
            if autosend:
                es = email_service_getter() if callable(email_service_getter) else email_service_getter
                await _scan_and_send_d1(db, es)
                await _scan_and_send_d3(db, es)
                await _scan_and_send_trial(db, es)
            else:
                n = await _count_candidates(db)
                nt = await _count_trial_candidates(db)
                n1 = await _count_d1_candidates(db)
                if n > 0 or nt > 0 or n1 > 0:
                    logger.info(f"[reeng] ожидают отправки: d1 {n1}, d3 {n}, trial_spent {nt} "
                                f"(autosend off, открой админку → Reengagement)")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"[reeng] scheduler iter error: {e}")
        # Раз в час — частоты «3 дня неактивности» с лихвой.
        await asyncio.sleep(3600)
