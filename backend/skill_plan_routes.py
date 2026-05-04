"""
skill_plan_routes.py — API для модуля выбора навыка (21-дневный план).

Endpoints:
  POST   /api/skill-plan                       — создать/обновить план для пользователя
  GET    /api/skill-plan/{user_id}             — получить план пользователя
  POST   /api/skill-plan/{user_id}/day-done    — отметить день выполненным
  POST   /api/skill-plan/{user_id}/day-undone  — снять отметку с дня
  POST   /api/skill-plan/{user_id}/settings    — обновить канал/время/режим
  DELETE /api/skill-plan/{user_id}             — удалить план (новый навык)

Таблица fredi_skill_plans создаётся автоматически на старте приложения.
"""

import json
import logging
import os
from datetime import datetime, timezone
from fastapi import Request

logger = logging.getLogger(__name__)

# Кэш шаблонов 21-дневных планов по навыкам.
# Файл backend/data/skill_plans.json — источник правды (версия в git).
# Загружаем один раз при первом обращении, в памяти держим до рестарта.
_SKILL_PLANS_CACHE = None

def _load_skill_plans():
    global _SKILL_PLANS_CACHE
    if _SKILL_PLANS_CACHE is not None:
        return _SKILL_PLANS_CACHE
    path = os.path.join(os.path.dirname(__file__), "data", "skill_plans.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            _SKILL_PLANS_CACHE = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load skill_plans.json: {e}")
        _SKILL_PLANS_CACHE = {}
    return _SKILL_PLANS_CACHE


def register_skill_plan_routes(app, db, limiter):
    """Регистрирует роуты модуля skill_plan и возвращает init-функцию для миграции."""

    async def init_skill_plan_tables():
        """Создаёт таблицу fredi_skill_plans + миграции."""
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_skill_plans (
                    user_id            BIGINT PRIMARY KEY,
                    skill_id           TEXT,
                    skill_name         TEXT,
                    skill_desc         TEXT,
                    skill_long_desc    TEXT,
                    skill_promise      TEXT,
                    plan               JSONB,
                    days_done          JSONB DEFAULT '[]'::jsonb,
                    started_at         TIMESTAMP WITH TIME ZONE,
                    channel            TEXT,
                    notify_time        TEXT DEFAULT '09:00',
                    mode               TEXT DEFAULT 'calm',
                    telegram_chat_id   BIGINT,
                    email              TEXT,
                    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            # Миграции: дедуп-колонки + таймзона юзера (Этап C/D)
            for col_def in (
                "ADD COLUMN IF NOT EXISTS last_sent_at         TIMESTAMP WITH TIME ZONE",
                "ADD COLUMN IF NOT EXISTS last_check_sent_at   TIMESTAMP WITH TIME ZONE",
                "ADD COLUMN IF NOT EXISTS last_eve_sent_at     TIMESTAMP WITH TIME ZONE",
                "ADD COLUMN IF NOT EXISTS tz                   TEXT DEFAULT 'UTC'",
            ):
                try:
                    await conn.execute(f"ALTER TABLE fredi_skill_plans {col_def}")
                except Exception:
                    pass
            try:
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_skill_plans_notify "
                    "ON fredi_skill_plans(channel, notify_time) "
                    "WHERE channel IS NOT NULL AND channel <> 'none'"
                )
            except Exception:
                pass
            # Кэш генерируемых конфайн-моделей для кастомных навыков.
            # Ключ — нормализованное название (skill_key), один и тот же
            # текст от разных юзеров вернёт один и тот же сгенерированный план.
            try:
                from services.skill_generator import CREATE_TABLE_SQL as _CUSTOM_DDL
                await conn.execute(_CUSTOM_DDL)
            except Exception as _e:
                logger.warning(f"custom skill plan table init failed: {_e}")
            # IANA-таймзона юзера (Europe/Moscow, Asia/Yekaterinburg, ...).
            # Шлётся фронтом один раз через POST /api/user/tz при первой
            # загрузке. Используется и в skill-plan-планировщике, и в
            # basic-chat-промпте для корректной даты/времени у юзера —
            # серверный UTC на Render иначе даёт «сегодня 3 мая» на 2 мая.
            try:
                await conn.execute(
                    "ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS user_tz TEXT"
                )
            except Exception as _e:
                logger.warning(f"user_tz column init failed: {_e}")
        logger.info("Skill plan tables ready")

    @app.post("/api/skill-plan")
    @limiter.limit("30/minute")
    async def save_skill_plan(request: Request):
        """Создать или обновить план пользователя.

        Body: {
            user_id, skill_id, skill_name, skill_desc, skill_long_desc, skill_promise,
            plan (object), channel, notify_time, mode, started_at (ISO string),
            email (optional)
        }
        """
        try:
            data = await request.json()
            user_id = data.get("user_id")
            if not user_id:
                return {"success": False, "error": "user_id required"}

            started_at = data.get("started_at")
            started_at_dt = None
            if started_at:
                try:
                    started_at_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                except Exception:
                    started_at_dt = datetime.now(timezone.utc)
            else:
                started_at_dt = datetime.now(timezone.utc)

            plan_json = json.dumps(data.get("plan") or {})

            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_skill_plans (
                        user_id, skill_id, skill_name, skill_desc, skill_long_desc,
                        skill_promise, plan, days_done, started_at, channel, notify_time,
                        mode, email, tz, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, '[]'::jsonb,
                              $8, $9, $10, $11, $12, $13, NOW(), NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        skill_id        = EXCLUDED.skill_id,
                        skill_name      = EXCLUDED.skill_name,
                        skill_desc      = EXCLUDED.skill_desc,
                        skill_long_desc = EXCLUDED.skill_long_desc,
                        skill_promise   = EXCLUDED.skill_promise,
                        plan            = EXCLUDED.plan,
                        days_done       = '[]'::jsonb,
                        started_at      = EXCLUDED.started_at,
                        channel         = EXCLUDED.channel,
                        notify_time     = EXCLUDED.notify_time,
                        mode            = EXCLUDED.mode,
                        email           = COALESCE(EXCLUDED.email, fredi_skill_plans.email),
                        tz              = COALESCE(EXCLUDED.tz, fredi_skill_plans.tz),
                        updated_at      = NOW()
                """,
                    int(user_id),
                    data.get("skill_id"),
                    data.get("skill_name"),
                    data.get("skill_desc"),
                    data.get("skill_long_desc"),
                    data.get("skill_promise"),
                    plan_json,
                    started_at_dt,
                    data.get("channel"),
                    data.get("notify_time") or "09:00",
                    data.get("mode") or "calm",
                    data.get("email"),
                    data.get("tz") or "UTC",
                )

            return {"success": True}

        except Exception as e:
            logger.error(f"save_skill_plan error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/skill-plan/{user_id}")
    @limiter.limit("60/minute")
    async def get_skill_plan(request: Request, user_id: int):
        """Получить план пользователя или null, если его нет."""
        try:
            row = await db.fetchrow(
                "SELECT * FROM fredi_skill_plans WHERE user_id = $1", user_id
            )
            if not row:
                return {"success": True, "plan": None}

            plan_data = row["plan"]
            if isinstance(plan_data, str):
                try:
                    plan_data = json.loads(plan_data)
                except Exception:
                    plan_data = None

            days_done = row["days_done"]
            if isinstance(days_done, str):
                try:
                    days_done = json.loads(days_done)
                except Exception:
                    days_done = []

            return {
                "success": True,
                "plan": {
                    "skill_id":         row["skill_id"],
                    "skill_name":       row["skill_name"],
                    "skill_desc":       row["skill_desc"],
                    "skill_long_desc":  row["skill_long_desc"],
                    "skill_promise":    row["skill_promise"],
                    "plan":             plan_data,
                    "days_done":        days_done or [],
                    "started_at":       row["started_at"].isoformat() if row["started_at"] else None,
                    "channel":          row["channel"],
                    "notify_time":      row["notify_time"],
                    "mode":             row["mode"],
                    "tz":               row["tz"] if "tz" in row.keys() else "UTC",
                    "telegram_chat_id": row["telegram_chat_id"],
                    "email":            row["email"],
                }
            }
        except Exception as e:
            logger.error(f"get_skill_plan error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/day-done")
    @limiter.limit("60/minute")
    async def mark_day_done(request: Request, user_id: int):
        """Отметить день выполненным. Body: {day: int}."""
        try:
            data = await request.json()
            day = int(data.get("day", 0))
            if day < 1 or day > 21:
                return {"success": False, "error": "day must be 1..21"}

            async with db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT days_done FROM fredi_skill_plans WHERE user_id = $1", user_id
                )
                if not row:
                    return {"success": False, "error": "plan not found"}
                days = row["days_done"] or []
                if isinstance(days, str):
                    days = json.loads(days)
                if day not in days:
                    days.append(day)
                    days = sorted(set(days))
                    await conn.execute(
                        "UPDATE fredi_skill_plans SET days_done = $1::jsonb, updated_at = NOW() "
                        "WHERE user_id = $2",
                        json.dumps(days), user_id
                    )
            return {"success": True, "days_done": days}
        except Exception as e:
            logger.error(f"mark_day_done error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/day-undone")
    @limiter.limit("60/minute")
    async def unmark_day(request: Request, user_id: int):
        """Снять отметку с дня. Body: {day: int}."""
        try:
            data = await request.json()
            day = int(data.get("day", 0))
            async with db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT days_done FROM fredi_skill_plans WHERE user_id = $1", user_id
                )
                if not row:
                    return {"success": False, "error": "plan not found"}
                days = row["days_done"] or []
                if isinstance(days, str):
                    days = json.loads(days)
                days = [d for d in days if d != day]
                await conn.execute(
                    "UPDATE fredi_skill_plans SET days_done = $1::jsonb, updated_at = NOW() "
                    "WHERE user_id = $2",
                    json.dumps(days), user_id
                )
            return {"success": True, "days_done": days}
        except Exception as e:
            logger.error(f"unmark_day error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/settings")
    @limiter.limit("30/minute")
    async def update_settings(request: Request, user_id: int):
        """Обновить канал/время/режим. Body: {channel, notify_time, mode, email}."""
        try:
            data = await request.json()
            async with db.get_connection() as conn:
                # Обновляем только переданные поля
                fields = []
                values = []
                idx = 1
                for key in ("channel", "notify_time", "mode", "email", "tz"):
                    if key in data:
                        fields.append(f"{key} = ${idx}")
                        values.append(data[key])
                        idx += 1
                if not fields:
                    return {"success": False, "error": "no fields to update"}
                fields.append("updated_at = NOW()")
                values.append(user_id)
                query = f"UPDATE fredi_skill_plans SET {', '.join(fields)} WHERE user_id = ${idx}"
                result = await conn.execute(query, *values)
                if result.endswith(" 0"):
                    return {"success": False, "error": "plan not found"}
            return {"success": True}
        except Exception as e:
            logger.error(f"update_settings error: {e}")
            return {"success": False, "error": str(e)}

    @app.delete("/api/skill-plan/{user_id}")
    @limiter.limit("10/minute")
    async def delete_skill_plan(request: Request, user_id: int):
        """Удалить план — пользователь хочет начать новый навык."""
        try:
            await db.execute(
                "DELETE FROM fredi_skill_plans WHERE user_id = $1", user_id
            )
            return {"success": True}
        except Exception as e:
            logger.error(f"delete_skill_plan error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/skill-plan/{user_id}/link-status")
    @limiter.limit("60/minute")
    async def get_link_status(request: Request, user_id: int):
        """Возвращает {telegram: bool, max: bool} — какие мессенджеры привязаны."""
        try:
            from services.skill_notify import get_link_status as _gls
            status = await _gls(db, user_id)
            return {"success": True, **status}
        except Exception as e:
            logger.error(f"link-status error: {e}")
            return {"success": False, "telegram": False, "max": False}

    @app.post("/api/skill-plan/{user_id}/test-send")
    @limiter.limit("6/minute")
    async def test_send(request: Request, user_id: int):
        """Отправляет тестовое сообщение в выбранный канал."""
        try:
            from services.skill_notify import send_test_message
            result = await send_test_message(db, user_id)
            return result
        except Exception as e:
            logger.error(f"test_send error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/welcome-send")
    @limiter.limit("6/minute")
    async def welcome_send(request: Request, user_id: int):
        """Отправляет приветствие при старте 21-дневной программы."""
        try:
            from services.skill_notify import send_welcome_message
            return await send_welcome_message(db, user_id)
        except Exception as e:
            logger.error(f"welcome_send error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/auth/messenger-token")
    @limiter.limit("60/minute")
    async def verify_messenger_auth(request: Request):
        """Проверяет HMAC-подписанные параметры fid+t из URL.

        Используется фронтом на загрузке страницы для автологина из
        мессенджер-кнопки (юзер открывает Фреди по ссылке из TG/MAX —
        мы доверяем ему этот user_id, не предлагаем регистрацию).

        Query params: fid (int), t (str).
        """
        try:
            from services.skill_notify import verify_messenger_token
            params = request.query_params
            try:
                fid = int(params.get("fid", "0"))
            except ValueError:
                fid = 0
            t = params.get("t", "")
            if verify_messenger_token(fid, t):
                return {"success": True, "user_id": fid}
            return {"success": False, "error": "invalid token"}
        except Exception as e:
            logger.error(f"verify_messenger_auth: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/skill-plan/template/{skill_id}")
    @limiter.limit("60/minute")
    async def get_skill_plan_template(request: Request, skill_id: str):
        """Возвращает шаблон 21-дневного плана для конкретного навыка.
        Если для навыка нет специализированного плана — отвечаем 404,
        фронт сам подставит универсальный fallback (DEFAULT_TEMPLATE_PLAN)."""
        plans = _load_skill_plans()
        plan = plans.get(skill_id)
        if not plan or not isinstance(plan, dict) or "weeks" not in plan:
            return {"success": False, "error": "no specialized template"}
        return {"success": True, "plan": {"weeks": plan["weeks"]}}

    @app.get("/api/skill-plan/details/{skill_id}")
    @limiter.limit("60/minute")
    async def get_skill_plan_details(request: Request, skill_id: str):
        """Возвращает «Подробнее»-карточку навыка: 9-элементную конфайнмент-
        модель + точки перехода (узлы, разрыв которых превращает «без навыка»
        в «с навыком», с привязкой к дням 21-дневного плана).

        Если для навыка модель ещё не написана — отдаём {success: false},
        фронт показывает заглушку «карточка ещё в работе»."""
        plans = _load_skill_plans()
        entry = plans.get(skill_id) or {}
        model = entry.get("model")
        transitions = entry.get("transitions")
        if not model or not isinstance(model, dict):
            return {"success": False, "error": "no model"}
        return {
            "success": True,
            "model": model,
            "transitions": transitions or [],
        }

    @app.post("/api/skill-plan/generate")
    @limiter.limit("8/hour")
    async def generate_custom_skill_plan(request: Request):
        """Генерирует конфайн-модель + 21-дневный план для кастомного навыка.

        Тяжёлая операция (один Anthropic-вызов, ~10–30 сек), поэтому
        rate-limit жёсткий: 8 запросов в час с одного IP. Результат
        кэшируется глобально по нормализованному ключу — повторный запрос
        с тем же названием берёт из кэша мгновенно.

        Body: {skill_name: str}
        Response (success):
          {success: true, model: {...}, transitions: [...], plan: {weeks: [...]}}
        Response (fail):
          {success: false, error: "..."}
        Фронт при success=false уходит на универсальный DEFAULT_TEMPLATE_PLAN.
        """
        try:
            body = await request.json()
        except Exception:
            return {"success": False, "error": "invalid json"}

        skill_name = (body.get("skill_name") or "").strip()
        if not skill_name or len(skill_name) > 200:
            return {"success": False, "error": "skill_name required (1–200 chars)"}

        try:
            from services.skill_generator import generate_custom_plan
            data = await generate_custom_plan(db, skill_name)
        except Exception as e:
            logger.error(f"generate_custom_skill_plan error: {e}")
            return {"success": False, "error": "generation failed"}

        if not data:
            return {"success": False, "error": "generation failed or invalid format"}

        return {
            "success": True,
            "model": data.get("model", {}),
            "transitions": data.get("transitions", []),
            "plan": data.get("plan", {}),
        }

    @app.post("/api/user/tz")
    @limiter.limit("30/minute")
    async def save_user_tz(request: Request):
        """Сохраняет IANA-таймзону юзера в fredi_users.user_tz.

        Фронт шлёт один раз при загрузке (Intl.DateTimeFormat).
        Используется и шедулером 21-дневного плана, и basic-chat-промптом —
        чтобы дата/время в общении совпадали с локальной зоной юзера, а не
        с серверным UTC на Render.

        Body: {user_id: int, tz: str (IANA)}
        Если tz не валиден или ZoneInfo его не понимает — игнорируем.
        """
        try:
            body = await request.json()
        except Exception:
            return {"success": False, "error": "invalid json"}

        try:
            uid = int(body.get("user_id") or 0)
        except Exception:
            uid = 0
        tz = (body.get("tz") or "").strip()

        if not uid or not tz or len(tz) > 60 or "/" not in tz:
            # Минимальная валидация: tz должен быть IANA-форматом «Region/City».
            return {"success": False, "error": "user_id and IANA tz required"}

        # Проверка через ZoneInfo — если не парсится, не сохраняем.
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(tz)
        except Exception:
            return {"success": False, "error": f"unknown timezone: {tz}"}

        try:
            await db.execute(
                """
                INSERT INTO fredi_users (user_id, user_tz, is_active)
                VALUES ($1, $2, TRUE)
                ON CONFLICT (user_id) DO UPDATE
                SET user_tz = EXCLUDED.user_tz,
                    updated_at = NOW()
                """,
                uid, tz,
            )
        except Exception as e:
            # Если строка fredi_users не была создана через этот путь
            # (упрощённый INSERT может не пройти из-за NOT NULL колонок),
            # пробуем чистый UPDATE.
            try:
                await db.execute(
                    "UPDATE fredi_users SET user_tz = $1, updated_at = NOW() WHERE user_id = $2",
                    tz, uid,
                )
            except Exception as e2:
                logger.warning(f"save_user_tz failed for {uid}: {e} / {e2}")
                return {"success": False, "error": "db error"}

        return {"success": True}

    return init_skill_plan_tables
