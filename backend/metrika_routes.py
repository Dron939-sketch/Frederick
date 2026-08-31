# -*- coding: utf-8 -*-
"""Живой счётчик посетителей Лектория из Яндекс.Метрики.

Зачем через сервер, а не из браузера: OAuth-токен Метрики даёт доступ ко
всей статистике сайта. На GitHub Pages он лежал бы в открытом JS, поэтому
запрос делает бэкенд, а наружу отдаётся одно число.

Отдельного «сколько человек онлайн» в Reporting API Метрики нет — есть
отчёт по времени (/stat/v1/data/bytime), а данные в Метрике появляются
почти без задержки. Поэтому берём визиты за последние минуты и честно
сообщаем фронту, каким окном посчитано (window): 'minute' — настоящее
«сейчас», 'hour' — «за последний час», если поминутная группировка счётчику
недоступна.

Без YANDEX_METRIKA_TOKEN эндпоинт отвечает enabled:false, и на сайте
остаётся прежняя оценочная кривая — страница не ломается.
"""
import asyncio
import logging
import os
import time

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

METRIKA_TOKEN = (os.getenv("YANDEX_METRIKA_TOKEN") or "").strip()
METRIKA_COUNTER = (os.getenv("YANDEX_METRIKA_COUNTER") or "108138656").strip()
METRIKA_API = "https://api-metrika.yandex.net/stat/v1/data/bytime"
# Что считаем «курсами»: страницы Лектория и сами лекции.
LEKTORIJ_FILTER = "ym:s:URL=@'/blog/lektorij/' OR ym:s:URL=@'/blog/lekciya-'"
# Окно «сейчас». Визит в Метрике живёт до 30 минут бездействия, поэтому
# 5 минут — это те, кто действительно на странице, а не «был сегодня».
ONLINE_MINUTES = 5
CACHE_TTL = 45          # к Метрике ходим раз в 45 с, остальным отдаём кэш
HTTP_TIMEOUT = 6.0

_cache = {"ts": 0.0, "data": None}
_lock = asyncio.Lock()
# Какая группировка реально работает для этого счётчика. Определяется первым
# успешным запросом и дальше не переспрашивается.
_group_mode = None


def metrika_configured() -> bool:
    return bool(METRIKA_TOKEN and METRIKA_COUNTER)


async def _ask(client: httpx.AsyncClient, group: str) -> list:
    """Ряд значений визитов по времени за сегодня. Пустой список — не вышло."""
    r = await client.get(
        METRIKA_API,
        params={
            "ids": METRIKA_COUNTER,
            "metrics": "ym:s:visits",
            "filters": LEKTORIJ_FILTER,
            "date1": "today",
            "date2": "today",
            "group": group,
            "limit": 1,
        },
        headers={"Authorization": f"OAuth {METRIKA_TOKEN}"},
    )
    if r.status_code != 200:
        logger.warning(f"metrika: group={group} → {r.status_code} {r.text[:200]}")
        return []
    js = r.json()
    rows = js.get("data") or []
    if not rows:
        # фильтр не дал ни строки — это не ошибка, просто пока никого
        return [0.0]
    series = (rows[0].get("metrics") or [[]])[0]
    return [float(x or 0) for x in series]


async def _fetch() -> dict:
    """Число посетителей и окно, которым оно посчитано."""
    global _group_mode
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        modes = [_group_mode] if _group_mode else ["minute", "hour"]
        for group in modes:
            series = await _ask(client, group)
            if not series:
                continue
            _group_mode = group
            if group == "minute":
                # хвост ряда — последние минуты; последняя точка бывает
                # ещё неполной, поэтому берём окно, а не одну минуту
                tail = series[-ONLINE_MINUTES:]
                return {"online": int(round(sum(tail))), "window": "minute"}
            return {"online": int(round(series[-1])), "window": "hour"}
    return {}


async def _cached() -> dict:
    now = time.time()
    if _cache["data"] is not None and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]
    async with _lock:
        now = time.time()
        if _cache["data"] is not None and now - _cache["ts"] < CACHE_TTL:
            return _cache["data"]
        try:
            data = await _fetch()
        except Exception as e:
            logger.warning(f"metrika: запрос не удался: {e}")
            data = {}
        if data:
            _cache["data"] = data
            _cache["ts"] = now
        elif _cache["data"] is not None:
            # Метрика моргнула — лучше отдать чуть устаревшее число,
            # чем уронить счётчик в «нет данных»
            _cache["ts"] = now - CACHE_TTL / 2
        return data or (_cache["data"] or {})


# Куда доходит человек с сайта. Приложение живёт на /fredi/, посадочная
# для поиска — /virtual-psychologist/.
FREDI_FILTER = "ym:s:URL=@'/fredi/' OR ym:s:URL=@'/virtual-psychologist/'"
TRAFFIC_API = "https://api-metrika.yandex.net/stat/v1/data"


async def _daily(client: httpx.AsyncClient, days: int, filt: str = "") -> dict:
    """{дата: (визиты, посетители)} за последние days дней."""
    params = {
        "ids": METRIKA_COUNTER,
        "metrics": "ym:s:visits,ym:s:users",
        "dimensions": "ym:s:date",
        "date1": "%ddaysAgo" % days,
        "date2": "today",
        "sort": "ym:s:date",
        "limit": 400,
    }
    if filt:
        params["filters"] = filt
    r = await client.get(TRAFFIC_API, params=params,
                         headers={"Authorization": f"OAuth {METRIKA_TOKEN}"})
    if r.status_code != 200:
        logger.warning("metrika traffic: %s %s", r.status_code, r.text[:200])
        return {}
    out = {}
    for row in (r.json().get("data") or []):
        day = (row.get("dimensions") or [{}])[0].get("name")
        m = row.get("metrics") or [0, 0]
        if day:
            out[day] = (int(m[0] or 0), int(m[1] or 0))
    return out


def register_metrika_routes(app, limiter):

    @app.get("/api/admin/metrika/traffic")
    @limiter.limit("20/minute")
    async def metrika_traffic(request: Request, days: int = 14):
        """Трафик сайта по дням и сколько его доходит до Фреди (админ).

        Аналитика приложения показывает 37 человек в неделю и не знает, что
        это — весь трафик сайта или его сотая доля. Тысяча статей и сотня
        курсов живут в Метрике, приложение — в своей базе, и связать их было
        нечем: разговор про конверсию упирался в то, что знаменатель
        неизвестен. Здесь он и считается.
        """
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected or (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return {"error": "forbidden"}
        if not metrika_configured():
            return {"enabled": False,
                    "message": "Нет YANDEX_METRIKA_TOKEN в env бэкенда"}
        days = max(1, min(int(days or 14), 90))
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT * 3) as client:
                site = await _daily(client, days)
                lektorij = await _daily(client, days, LEKTORIJ_FILTER)
                fredi = await _daily(client, days, FREDI_FILTER)
        except Exception as e:
            logger.warning("metrika traffic failed: %s", e)
            return {"enabled": True, "error": str(e)[:200]}

        rows = []
        for day in sorted(site.keys() | lektorij.keys() | fredi.keys()):
            sv, su = site.get(day, (0, 0))
            lv, lu = lektorij.get(day, (0, 0))
            fv, fu = fredi.get(day, (0, 0))
            rows.append({"date": day, "site_visits": sv, "site_users": su,
                         "lektorij_visits": lv, "lektorij_users": lu,
                         "fredi_visits": fv, "fredi_users": fu})
        tot_site = sum(r["site_users"] for r in rows)
        tot_fredi = sum(r["fredi_users"] for r in rows)
        return {
            "enabled": True,
            "counter": METRIKA_COUNTER,
            "days": days,
            "rows": rows,
            "totals": {
                "site_users": tot_site,
                "lektorij_users": sum(r["lektorij_users"] for r in rows),
                "fredi_users": tot_fredi,
                # доля дошедших до приложения — то самое недостающее звено
                # между «тысяча статей» и «37 человек в приложении»
                "site_to_fredi_pct": round(100.0 * tot_fredi / tot_site, 2) if tot_site else None,
            },
        }


    @app.get("/api/metrika/online")
    @limiter.limit("120/minute")
    async def metrika_online(request: Request):
        if not metrika_configured():
            return {"enabled": False}
        data = await _cached()
        if not data:
            return {"enabled": False}
        return {"enabled": True, "online": data["online"],
                "window": data["window"], "ttl": CACHE_TTL}
