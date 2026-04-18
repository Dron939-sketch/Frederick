# Настройка Web Push (VAPID)

## ⚠️ Срочно: старые ключи скомпрометированы

В коде (`backend/services/push_service.py`) до этой правки лежал
**публично читаемый VAPID private key** в git-истории. Это значит, что
любой, у кого есть доступ к репе, может отправлять push-уведомления
вашим подписчикам от имени домена.

**Действия:**
1. Сгенерировать **новую** VAPID-пару (см. ниже)
2. Положить её в **Render → Environment → Environment Variables**
3. Задеплоить бэк
4. Пользователи должны заново разрешить уведомления (старые подписки, привязанные к старому публичному ключу, перестанут работать — это нормально)

---

## 1. Сгенерировать новую VAPID-пару

**Вариант A — Python (py-vapid):**
```bash
pip install py-vapid
vapid --applicationServerKey
# Вывод (пример):
# Application Server Key = BP-y....
# Private Key = <base64-строка>
```

**Вариант B — Node (web-push):**
```bash
npx web-push generate-vapid-keys
# Public Key: BP-y....
# Private Key: <base64-строка>
```

**Вариант C — онлайн:** https://vapidkeys.com/ (доверяй только себе — ключ не должен быть чужим)

Результат — пара base64-строк: PUBLIC начинается с `B`, PRIVATE короче (~43 символа).

---

## 2. Положить в Render

Render → твой сервис `fredi-backend-*` → **Environment** → Add Environment Variable:

| Key | Value | Пример |
|---|---|---|
| `VAPID_PUBLIC_KEY`  | base64-строка, начинается с `B`    | `BP-yST0x...` (≈88 символов) |
| `VAPID_PRIVATE_KEY` | base64-строка, короче               | `MIGHAgEA...` (≈43 символа для DER-формата или ~43 для raw base64url) |
| `VAPID_CONTACT`     | `mailto:<ваш-email>`                | `mailto:admin@meysternlp.ru` |

Сохранить → Render перезапустит сервис.

---

## 3. Проверить что работает

После деплоя открой:

```
GET https://fredi-backend-flz2.onrender.com/api/push/diagnostics
GET https://fredi-backend-flz2.onrender.com/api/push/diagnostics?user_id=<твой user_id>
```

Ожидаемый ответ:
```json
{
  "success": true,
  "push_service_ready": true,
  "vapid_public_set": true,
  "vapid_private_set": true,
  "push_enabled": true,
  "vapid_contact": "mailto:admin@meysternlp.ru",
  "vapid_public_key_preview": "BP-yST0xJbEGx5qf...",
  "morning_manager_ready": true,
  "active_subscriptions_total": 0,
  ...
}
```

Если `push_enabled=false` — ключи не подтянулись. Проверь env в Render и логи на старте:
`❌ VAPID ключи не заданы в env`.

---

## 4. Тестовая отправка утреннего сообщения

Без ожидания 9:00:
```bash
curl -X POST https://fredi-backend-flz2.onrender.com/api/morning/send-now \
  -H 'Content-Type: application/json' \
  -d '{"user_id": 12345, "day": 1, "dry_run": false}'
```

- `day: 1..5` — день недели (5 = пятница → генерируется weekend-сообщение)
- `dry_run: true` — только сгенерировать текст, не отправлять и не писать в БД

Ответ содержит `message` (полный текст) и `delivered` (дошло ли в канал пользователя).

---

## Как это работает

`morning_messages_scheduler` (`backend/main.py`) запускается в фоне, проверяет каждую минуту:
- Пользователь прошёл тест (есть `behavioral_levels` в профиле)
- `notification_channel` ≠ `'none'`
- Есть активная push-подписка или привязан мессенджер (telegram/max)
- Сейчас у пользователя пн-пт, 9:00-9:05 по его `timezone_offset`
- Сегодня ещё не отправляли (`last_morning_sent_at`)

Сообщение генерирует `MorningMessageManager` из `backend/morning_messages.py`:
- День 1 (пн) — шаблон без AI (быстро)
- Дни 2-4 (вт-чт) — AI-промпт с темой дня
- День 5 (пт) — AI-промпт с идеями на выходные

Доставка по `notification_channel`:
- `push` → короткий body до 120 символов (полный текст читается в приложении)
- `telegram` / `max` → полный текст через соответствующий бот-токен
- `none` → не отправляется
