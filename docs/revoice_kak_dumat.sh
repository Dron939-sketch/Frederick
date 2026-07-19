#!/usr/bin/env bash
# Переозвучка 12 лекций курса «Как думать» после правок текста.
# Кэш mp3 вечный (ключ = slug), поэтому нужен force: ручка сама удалит
# старые mp3+meta и озвучит заново, последовательно (Fish не разгоняется).
#
# Запуск:  ADMIN_TOKEN=ваш_токен bash docs/revoice_kak_dumat.sh
# Прогресс: тот же скрипт с аргументом status.

set -euo pipefail
BASE="https://ffred-ddd989.amvera.io"
: "${ADMIN_TOKEN:?Задайте ADMIN_TOKEN: ADMIN_TOKEN=... bash $0}"

if [ "${1:-}" = "status" ]; then
  curl -sS "$BASE/api/tts/blog/pregenerate" -H "X-Admin-Token: $ADMIN_TOKEN"
  echo
  exit 0
fi

curl -sS -X POST "$BASE/api/tts/blog/pregenerate" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "force": true,
    "slugs": [
      "lekciya-dumat-1-privatnoe-i-publichnoe",
      "lekciya-dumat-2-mysl-vsluh",
      "lekciya-dumat-3-popugaj",
      "lekciya-dumat-4-reviziya-sklada",
      "lekciya-dumat-5-chtenie-ne-glaza",
      "lekciya-dumat-6-svoimi-slovami",
      "lekciya-dumat-7-obraz-i-svyaz",
      "lekciya-dumat-8-vopros-k-tekstu",
      "lekciya-dumat-9-monitoring",
      "lekciya-dumat-10-slushat-ne-slyshat",
      "lekciya-dumat-11-vosproizvedenie",
      "lekciya-dumat-12-navyk-i-privychka"
    ]
  }'
echo
echo "Запущено. Прогресс: ADMIN_TOKEN=... bash $0 status"
