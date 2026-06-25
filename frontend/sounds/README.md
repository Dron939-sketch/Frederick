# Звуковые файлы Фреди

## welcome.mp3

Хардкод-голосовое приветствие, играется ОДИН РАЗ при первой регистрации
(через 3 сек после reload). См. логику в `fredi/app.js` (DOMContentLoaded
handler) и триггер в `fredi/login.js` (после `_track('register_success')`).

**Текст для генерации:**
> Привет. Я Фреди. Если захочешь поговорить — нажимай и говори, я рядом.

**Параметры:**
- Формат: MP3
- Голос: Fish Audio mode `psychologist` (тот же, что в TTS)
- Длительность: ~5 сек
- Volume в плеере: 0.85

**Как сгенерировать:**
1. Открыть админку → любой блок с кнопкой 🔊 TTS (например в Mirror-pitch)
2. Подставить текст выше → нажать «Озвучить» → скачать mp3
3. Положить файл сюда как `welcome.mp3`
4. Commit + push

Альтернатива: curl напрямую через `/api/admin/tts/synthesize` с `X-Admin-Token`:
```bash
curl -X POST https://fredi-backend-flz2.onrender.com/api/admin/tts/synthesize \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: audio/mpeg" \
  -d '{"text":"Привет. Я Фреди. Если захочешь поговорить — нажимай и говори, я рядом.","mode":"psychologist"}' \
  --output welcome.mp3
```
