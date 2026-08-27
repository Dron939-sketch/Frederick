# -*- coding: utf-8 -*-
"""Озвучка статей блога голосом Yandex SpeechKit.

Принцип: генерируем ОДИН раз, сохраняем в data/tts_blog/{slug}.mp3
и дальше отдаём файл. Первый слушатель ждёт генерацию (~15–30 сек),
остальные получают мгновенно. Ключ — тот же YANDEX_API_KEY, что и
у голоса Фреди; если ключа нет, эндпоинты честно отвечают disabled,
и фронт откатывается на браузерный синтез.
"""
import asyncio
import binascii
import hashlib
import hmac
import html as html_mod
import json
import logging
import os
import re
import time

import httpx
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

logger = logging.getLogger(__name__)

YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
TTS_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"
# Провайдер: 'yandex' (голос filipp, ~13 руб/статья) или 'fish' —
# фирменный мужской голос Фреди из чата (~в 2-3 раза дороже на русском,
# зато блог и приложение говорят одним голосом). При падении Fish
# автоматически откатываемся на Яндекс.
BLOG_TTS_PROVIDER = os.getenv("BLOG_TTS_PROVIDER", "fish").lower()
BLOG_TTS_VOICE = os.getenv("BLOG_TTS_VOICE", "filipp")
BLOG_TTS_SPEED = os.getenv("BLOG_TTS_SPEED", "1.0")
SITE_BASE = os.getenv("BLOG_TTS_SITE", "https://meysternlp.ru")
# Инлайн-метки Fish ([pause], [long pause]…) для тонкого контроля пауз/интонации.
# Работают ТОЛЬКО на моделях Fish S2/S2.1 — иначе читаются вслух. Поэтому по
# умолчанию выключено: включай BLOG_TTS_FISH_TAGS=1 лишь после того, как убедишься,
# что голос Фреди работает на S2/S2.1. На Яндекс-ветке метки вырезаются всегда.
BLOG_TTS_FISH_TAGS = os.getenv("BLOG_TTS_FISH_TAGS", "0").strip().lower() in ("1", "true", "yes", "on")

# mp3 храним на постоянном диске (на Amvera он смонтирован в /data), чтобы
# озвучка переживала редеплой контейнера и не переозвучивалась Fish заново —
# кэш ключуется по slug, поэтому перерендер HTML файлы не сбрасывает. Локально
# /data нет — откатываемся на каталог рядом с бэкендом. Путь переопределяется
# через BLOG_TTS_DIR.
_DEFAULT_TTS_DIR = (
    "/data/tts_blog" if os.path.isdir("/data")
    else os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tts_blog")
)
TTS_DIR = os.getenv("BLOG_TTS_DIR", _DEFAULT_TTS_DIR)
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,120}$")
CHUNK_LIMIT = 4500          # лимит Yandex v1 — 5000 символов на запрос
FISH_CHUNK_LIMIT = 1400     # Fish генерирует медленно: длинный кусок не успевает
FISH_TIMEOUT = 120.0        # ...поэтому куски короче, а таймаут щедрее
MAX_ARTICLE_CHARS = 60000   # предохранитель от аномально длинных страниц

# Версия конвейера озвучки. Меняются голос, режиссёр, промт или разбор
# страницы — поднимаем на единицу. Сама по себе перегенерацию она не
# запускает (см. _cache_ok: за уже озвученное Fish дважды не платим), но
# записывается в мету и позволяет отличить файлы, сделанные старым
# конвейером, и переозвучить их точечно через pregenerate?force=1.
# 5: разбор страницы перестал терять текст на служебных блоках.
# 6: настоящие паузы тишиной по метке [ПАУЗА N]; литература больше не
#    зачитывается; прощание без приглашения в приложение.
# 7: метки пауз защищены от normalize_numbers — раньше «[ПАУЗА 6]»
#    превращалась в «[ПАУЗА шесть]» и вся тишина молча пропадала.
TTS_CACHE_VERSION = 7


def _tts_available() -> bool:
    """Есть ли чем озвучивать. Раньше здесь проверялся только ключ Яндекса —
    и при работе на одном Fish (провайдер по умолчанию!) вся озвучка блога
    отвечала «tts disabled», хотя голос Фреди был настроен."""
    if BLOG_TTS_PROVIDER == "fish":
        try:
            from services.fish_audio_service import fish_configured
            if fish_configured():
                return True
        except Exception:
            pass
    return bool(YANDEX_API_KEY)

# Блоки, которые не читаем вслух (виджеты, ссылки, служебное)
_SKIP_CLASSES = ("selfcheck", "fredi-ask-box", "game-link-box", "related-articles",
                 "author-block", "author-box", "cta-block", "toc-box")

# Открывающий тег любого контейнера, у которого в class есть служебный класс.
# Ищем не только div: оглавление на большей части статей размечено как <nav>.
_SKIP_OPEN_RE = re.compile(
    r'<(div|nav|section|aside)\b[^>]*\bclass="[^"]*\b(?:%s)\b[^"]*"[^>]*>'
    % "|".join(_SKIP_CLASSES),
    re.I,
)


def _drop_skip_blocks(body: str) -> str:
    """Убирает служебные блоки вместе с содержимым, считая вложенность.

    Раньше это делал один регэксп вида «открывающий тег ... до `</div></div>`».
    Он молча съедал статью целиком, если у блока не оказывалось двух закрывающих
    тегов подряд: непожадный поиск уезжал вперёд до ближайшей такой пары —
    то есть на середину следующего раздела. На страницах с блоком самопроверки
    и на лекциях, где оглавление размечено как <div>, в озвучку уходило
    восемь-двадцать процентов текста: вступление и хвост, а вся суть пропадала.
    Считаем границы блока по вложенности — промахнуться уже нельзя.
    """
    out, pos = [], 0
    while True:
        m = _SKIP_OPEN_RE.search(body, pos)
        if not m:
            break
        tag = m.group(1).lower()
        depth, i = 1, m.end()
        step = re.compile(r"<(/?)%s\b" % tag, re.I)
        while depth and i < len(body):
            t = step.search(body, i)
            if not t:
                i = len(body)
                break
            depth += -1 if t.group(1) else 1
            i = body.find(">", t.end())
            i = len(body) if i < 0 else i + 1
        out.append(body[pos:m.start()])
        pos = i
    out.append(body[pos:])
    return " ".join(out)

_PAUSE_RE = re.compile(r"\[ПАУЗА(?:\s+(\d+))?\]", re.I)
_locks: dict = {}
_gen_tasks: dict = {}   # slug -> asyncio.Task фоновой генерации
_gen_errors: dict = {}  # slug -> текст последней ошибки генерации


def _extract_text(page: str) -> str:
    """Достаёт из HTML статьи связный текст для озвучки."""
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    title = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""

    # Тело статьи размечено по-разному: на большинстве страниц это <div>, а на
    # десяти лекциях курса «Переход» — <article>. Жёсткий поиск по <div> там не
    # срабатывал, и диктору уходила вся страница целиком. Обошлось: в шапке и
    # подвале этих страниц нет текста в тегах, которые вообще попадают в
    # озвучку, — но держаться на таком совпадении нельзя, любая правка вёрстки
    # его сломает. Принимаем любой контейнер.
    body = page
    _open = r'<(?:div|article|section|main) class="article-content">'
    mc = re.search(_open + r'(.*)</(?:div|article|section|main)>\s*\n*<div class="cta-block">',
                   page, re.S)
    if not mc:
        mc = re.search(_open + r'(.*?)<div class="related-articles">', page, re.S)
    if not mc:
        mc = re.search(_open + r'(.*?)</(?:div|article|section|main)>\s*$', page, re.S)
    if mc:
        body = mc.group(1)

    # выкидываем скрипты/стили и нечитаемые блоки
    body = re.sub(r"<script.*?</script>", " ", body, flags=re.S)
    body = re.sub(r"<style.*?</style>", " ", body, flags=re.S)
    body = _drop_skip_blocks(body)

    # «План лекции/статьи» — оглавление в прозе. Глазами оно сканируется за
    # секунду, ухом — минута перечислений «первое… седьмое» ровно на 90-й
    # секунде, где слушатель решает, оставаться ли. Прогон через тестовых
    # слушателей показал: именно здесь случайный человек тянется к выключателю.
    # Класс key-takeaway общий, режем по подписи блока.
    body = re.sub(
        r'<div class="key-takeaway">\s*<span class="takeaway-label">План\s+'
        r'(?:лекции|статьи)</span>.*?</div>',
        " ", body, flags=re.S)

    # подписи к схемам/иллюстрациям -> маркер для лектора,
    # оставленный на своём месте в потоке текста
    def _cap_to_marker(cm):
        c = re.sub(r"<[^>]+>", " ", cm.group(1))
        c = re.sub(r"\s+", " ", html_mod.unescape(c)).strip()
        return "<p>[СХЕМА: " + c + "]</p>" if c else " "

    body = re.sub(r"<figcaption[^>]*>(.*?)</figcaption>", _cap_to_marker, body, flags=re.S)

    # Авторская пауза. Задания лекции идут лестницей «задание — тишина —
    # разбор», и место тишины выбирает автор, а не модель: если пауза уедет
    # на предложение позже, слушатель услышит ответ раньше, чем успеет
    # ответить сам, и упражнение обессмыслится. На странице элемент пуст и
    # ничего не показывает; в озвучке превращается в метку паузы.
    def _pause_to_marker(pm):
        try:
            sec = int(pm.group(1))
        except (TypeError, ValueError):
            sec = 5
        return "<p>[ПАУЗА %d]</p>" % sec

    body = re.sub(
        r'<span[^>]*\bclass="pause"[^>]*\bdata-sec="(\d+)"[^>]*>\s*</span>',
        _pause_to_marker, body, flags=re.I)

    # Таблицы: диктору достаётся только <h2|h3|p|li>, поэтому раньше содержимое
    # таблиц пропадало из озвучки целиком — а в статьях блога это часто ядро
    # материала (сравнения «было/стало», типологии). Разворачиваем таблицу в
    # прозу: шапка запоминается, каждая строка читается как «ячейка шапки —
    # значение», строки разделяются точкой с запятой.
    def _table_to_prose(tm):
        raw = tm.group(0)
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", raw, flags=re.S)
        if not rows:
            return " "

        def _cells(row, tag):
            out = []
            for c in re.findall(r"<%s[^>]*>(.*?)</%s>" % (tag, tag), row, flags=re.S):
                c = re.sub(r"<[^>]+>", " ", c)
                c = re.sub(r"\s+", " ", html_mod.unescape(c)).strip()
                out.append(c)
            return out

        header, lines = [], []
        for row in rows:
            th = _cells(row, "th")
            if th and not header:
                header = th
                continue
            td = _cells(row, "td")
            if not td:
                continue
            if header and len(header) == len(td):
                # первая колонка обычно — название строки, она и есть подлежащее
                subj = td[0]
                pairs = ["%s: %s" % (header[i], td[i]) for i in range(1, len(td)) if td[i]]
                lines.append("%s — %s" % (subj, "; ".join(pairs)) if pairs else subj)
            else:
                lines.append(" — ".join(x for x in td if x))
        if not lines:
            return " "
        return "<p>" + " ".join(l.rstrip(".") + ". " for l in lines) + "</p>"

    body = re.sub(r"<table.*?</table>", _table_to_prose, body, flags=re.S)

    # сами SVG-схемы диктору не нужны (и их <polygon>/<line> не должны
    # ловиться регэкспом как <p>/<li>)
    body = re.sub(r"<svg.*?</svg>", " ", body, flags=re.S)

    parts = [title + "."] if title else []
    for tag_m in re.finditer(r"<(h2|h3|p|li)(?=[\s>])[^>]*>(.*?)</\1>", body, re.S):
        tag = tag_m.group(1)
        t = re.sub(r"<[^>]+>", " ", tag_m.group(2))
        t = html_mod.unescape(t)
        t = re.sub(r"\s+", " ", t).strip()
        # Инлайновый тег перед знаком препинания оставлял пробел: «ты
        # пропускаешь<em>!</em>» превращалось в «ты пропускаешь !», и диктор
        # читал это с лишней запинкой. По Лекторию таких мест 13 тысяч
        # в 611 лекциях. Пробел перед знаком убираем, после — оставляем.
        t = re.sub(r"\s+([,.!?;:%)\]»])", r"\1", t)
        t = re.sub(r"([(\[«])\s+", r"\1", t)
        if len(t) < 3:
            continue
        # эмодзи и прочие пиктограммы диктору не нужны
        t = re.sub(
            "[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]", "", t
        ).strip()
        if not t:
            continue
        # Метке паузы точка не нужна: после вырезания метки в тексте осталась
        # бы висячая точка, и синтезатор начинал бы следующий кусок с неё.
        if not t.endswith((".", "!", "?", ":", ";")) and not _PAUSE_RE.fullmatch(t):
            t += "."
        # заголовки помечаем — дальше их превратит в речевые переходы
        # либо LLM-рерайт, либо простая замена в _plain_speech
        if tag in ("h2", "h3"):
            t = "\n§ " + t + "\n"
        parts.append(t)
    text = " ".join(parts)
    text = _drop_bibliography(text)
    text = _drop_faq(text)
    return text[:MAX_ARTICLE_CHARS]


# Список литературы стоит последним разделом лекции. Глазами его пролистывают,
# ухом — выслушивают: две минуты фамилий и названий в самом конце, когда
# внимание уже на исходе. По всему Лекторию это около сорока часов звука,
# который никто не запоминает. Режиссёру велено раздел пропускать, но полагаться
# на послушность модели нельзя — да и запасной путь без LLM её не спрашивает.
# Хвост заголовка — до конца строки: «Литература к лекции», «Литература и куда
# дальше», «Литература — что читать после курса» (55 лекций) со старым шаблоном
# не совпадали и уходили в озвучку целиком.
_BIBLIO_RE = re.compile(r"\n§ (?:Литератур\w*|Что почитать)[^\n]*\n", re.I)
# «Источники» — заодно и обычное слово: лекция «Устойчивость» курса
# «Стресс-менеджмент» несла раздел «Источники устойчивости» и теряла на нём
# 72% озвучки (три минуты вместо одиннадцати). Поэтому по «Источникам» режем
# только тогда, когда за ними и правда список литературы: короткий хвост
# в конце лекции, а не половина материала.
_BIBLIO_SRC_RE = re.compile(r"\n§ Источник\w*[^\n]*\n", re.I)
_BIBLIO_TAIL_MAX = 0.25


def _drop_bibliography(text: str) -> str:
    m = _BIBLIO_RE.search(text)
    if m:
        return text[:m.start()].rstrip()
    for sm in _BIBLIO_SRC_RE.finditer(text):
        tail = _drop_faq(text[sm.end():])
        if len(tail) <= len(text) * _BIBLIO_TAIL_MAX:
            return text[:sm.start()].rstrip()
    return text


# FAQ в озвучке — повтор уже сказанного другими словами. Прогон курса через
# тестовых слушателей показал: хвост «Итоги + FAQ + самопроверка» приучает
# проматывать последнюю треть лекции, и этот навык затем съедает лекции
# целиком. На странице FAQ обязателен (Google, цитаты для языковых моделей),
# в ухо он не нужен. Вопросы для самопроверки остаются: это работа, а не повтор.
_FAQ_RE = re.compile(r"\n§ [^\n]*Частые вопросы[^\n]*\n", re.I)
# Вопросы внутри FAQ — это h3, и в извлечённом тексте они выглядят так же,
# как заголовки разделов («§ …»). Поэтому резать «до следующего §» нельзя —
# отрежется один заголовок. Режем до следующего ИЗВЕСТНОГО раздела хвоста.
_FAQ_END_RE = re.compile(r"\n§ (?:Вопросы для самопроверки|Итоги)", re.I)


def _drop_faq(text: str) -> str:
    m = _FAQ_RE.search(text)
    if not m:
        return text
    e = _FAQ_END_RE.search(text, m.end())
    if not e:
        return text[:m.start()].rstrip()
    return text[:m.start()].rstrip() + "\n" + text[e.start() + 1:]


# ===== Подготовка речи: из текста статьи — в устную лекцию =====

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro")
# off | lectures (только lekciya-*) | all
BLOG_TTS_REWRITE = os.getenv("BLOG_TTS_REWRITE", "lectures").lower()

_REWRITE_PROMPT = (
    "Ты — Фреди, виртуальный психолог и лектор. Ты записываешь аудиолекцию для своего "
    "лектория: слушатель выбрал тему, и ты лично читаешь ему лекцию. Преврати фрагмент "
    "письменного текста в свою живую устную речь. Правила:\n"
    "1) Сохрани ВСЕ факты, имена, термины и порядок аргументации. Ничего не добавляй по содержанию.\n"
    "2) Строки, начинающиеся с «§», — это заголовки разделов: преврати их в естественные "
    "речевые переходы («Теперь давайте разберём…», «Переходим к следующему вопросу…», "
    "«И наконец —…»), не читая слово «раздел» механически.\n"
    "3) Все числа, годы, проценты и диапазоны напиши словами в правильном падеже "
    "(«в тысяча девятьсот тридцать седьмом году», «от двадцати трёх до двадцати девяти лет»).\n"
    "4) Убери упоминания ссылок, кнопок, «в статье», «см. ниже» — замени на «в этой лекции», "
    "«как мы уже говорили». Списки перескажи связной речью с перечислительными связками.\n"
    "5) Пиши для уха, а не для глаза: предложения заметно короче письменных, одна мысль — "
    "одно предложение. Самые важные тезисы повторяй перефразом («Ещё раз, это важно: …»). "
    "Пунктуация — твой инструмент темпа и интонации: запятые дают лёгкие паузы, тире — "
    "паузу-акцент перед важной мыслью, многоточие — ощутимую паузу для осмысления, "
    "вопросительный знак — вопросительную интонацию. Расставляй их осознанно, чтобы речь "
    "дышала; после ключевых мыслей и перед новым разделом ставь многоточие.\n"
    "6) Обращайся к слушателю на «вы», добавляй живые связки и риторические вопросы, где уместно, — "
    "но без воды и без сюсюканья. Тон: тёплый увлечённый лектор, который любит свой предмет.\n"
    "7) Вопросы для самопроверки — не формальность, а главный инструмент усвоения. Оформи их "
    "как обращение («А теперь — вопросы, над которыми стоит подумать») и после КАЖДОГО "
    "вопроса ставь [ПАУЗА 8]: иначе слушатель услышит четыре вопроса подряд и не ответит "
    "ни на один. Если вопросов больше трёх — оставь три самых важных.\n"
    "8) Пометки вида [СХЕМА: …] означают иллюстрацию на странице лекции: сошлись на неё "
    "естественно («если вы открыли лекцию на экране — взгляните на схему: …») и перескажи её суть "
    "словами, чтобы слушателю без экрана тоже было понятно.\n"
    "9) Аббревиатуры (КПТ, НЛП, СДВГ, ЭИ, IQ) при первом упоминании расшифруй словами; если "
    "расшифровка громоздкая — произнеси по буквам так, как это звучит вслух («ка-пэ-тэ»). "
    "Латиницу и иностранные вкрапления (vs, etc., PhD, IQ) замени русским словом или транскрипцией — "
    "в озвучке не должно остаться латинских букв.\n"
    "10) Разнообразь переходы: не начинай разделы одной и той же связкой и не повторяй уже "
    "сказанные обороты. Внутри лекции не здоровайся и не представляйся повторно.\n"
    "11) ГЛАВНОЕ ПРО ПАУЗЫ. Лекцию слушают, а не читают: остановиться и подумать слушатель "
    "не может — если ты не остановишься сам. Везде, где текст просит слушателя что-то "
    "сделать в уме («вспомните», «назовите», «посчитайте», «спросите себя», «представьте»), "
    "а также после вопроса, ответ на который слушатель должен попробовать угадать сам, "
    "ставь отдельной строкой метку [ПАУЗА 5] — это настоящая тишина такой длины в секундах. "
    "Правила: метка идёт СРАЗУ после задания и ДО ответа; ответ никогда не должен стоять "
    "в том же предложении, что и вопрос. [ПАУЗА 3] — на короткое вспоминание, [ПАУЗА 5] — "
    "на счёт или выбор примера, [ПАУЗА 8] — если просят произнести фразу вслух или "
    "записать. Не больше четырёх меток на фрагмент: пауза ценна редкостью. Других "
    "квадратных скобок не изобретай. Если метка [ПАУЗА N] уже стоит в присланном "
    "тексте — её поставил автор в точно выбранном месте: сохрани её ровно там, где она "
    "стоит, не двигай и не меняй длину.\n"
    "12) Список литературы вслух не читай вообще: перечисление фамилий и названий на слух "
    "не запоминается и съедает конец лекции. Если раздел с литературой встретился — "
    "пропусти его целиком, ничем не заменяя.\n"
    "13) ЖИВОСТЬ. Ты не диктор у микрофона, а увлечённый рассказчик, которому не терпится "
    "поделиться: слушатель должен попасть в поток рассказа, а не терпеть изложение. Для этого:\n"
    "— ритм: после одного-двух длинных объясняющих предложений ставь короткое ударное "
    "(«Неправда.», «Вот и всё.», «И это работает.»); никогда не давай трёх длинных подряд;\n"
    "— где в тексте уже есть неожиданный поворот или курьёз, не сглаживай его, а подай как "
    "анекдот: разгон, многоточие перед развязкой… и развязка отдельной короткой фразой;\n"
    "— перечисления превращай в нарастание с интонацией («первое… второе… и наконец — "
    "главное»), а не в монотонный список;\n"
    "— говори «я» и «мы с вами», удивляйся вместе со слушателем («и вот тут начинается "
    "самое интересное»), риторический вопрос произноси как настоящий вопрос;\n"
    "— лёгкая улыбка и самоирония Фреди уместны один-три раза за фрагмент; шутить можно "
    "над механизмами и над собой, никогда — над слушателем;\n"
    "— запрещён канцелярит: «следует отметить», «важно понимать», «данный», «является» — "
    "заменяй живым глаголом.\n"
    "При этом факты, имена и числа — только из присланного текста: живость делается подачей, "
    "а не выдумкой.\n"
    "Выведи ТОЛЬКО готовый текст для озвучки: без markdown, без заголовков, без комментариев."
)

_OPENING_NOTE = (
    "\nЭто ПЕРВЫЙ фрагмент лекции. Начни с короткого приветствия от первого лица: "
    "поздоровайся, представься («С вами Фреди»), назови тему сегодняшней лекции своими словами "
    "и одной фразой скажи, чем она будет полезна. Затем плавно переходи к материалу."
)
_CLOSING_NOTE = (
    "\nЭто ПОСЛЕДНИЙ фрагмент лекции. Заверши двумя-тремя фразами: коротко поблагодари за "
    "внимание и назови одно конкретное действие, которое слушателю стоит сделать сегодня по "
    "следам лекции. Про приложение, лекторий и продолжение курса не говори ничего: слушатель "
    "и так внутри курса, а повторённое приглашение в конце каждой лекции звучит рекламой."
)
_CONTINUITY_NOTE = (
    "\nЭто ПРОДОЛЖЕНИЕ уже идущей лекции, не первый фрагмент. Предыдущая часть закончилась так:\n"
    "«…{tail}»\n"
    "Продолжи ровно с этого места: НЕ здоровайся и НЕ представляйся заново, не повторяй уже "
    "сказанные связки и мысли, подхвати нить рассуждения естественно и веди дальше."
)
# Инлайн-метки Fish (модели S2/S2.1) — тонкий контроль пауз и интонации прямо
# в тексте. Подключается только при BLOG_TTS_FISH_TAGS=1; на Яндекс-ветке метки
# всё равно вырезаются, поэтому речь нигде не зачитает их вслух.
_FISH_TAGS_NOTE = (
    "\nМожешь ИЗРЕДКА, только в местах настоящих пауз и акцентов, вставлять управляющие "
    "метки в квадратных скобках прямо в текст — строго из этого списка и только по-английски: "
    "[pause] — короткая пауза, [long pause] — заметная пауза перед важной мыслью или новым "
    "разделом, [thoughtful] — задумчивая интонация, [warm] — тёплая интонация. Не больше "
    "нескольких меток на фрагмент, никогда не внутри слова, других меток не придумывай."
)


async def _deepseek_rewrite(
    client: httpx.AsyncClient,
    segment: str,
    position: str = "",
    prev_tail: str = "",
) -> str:
    system = _REWRITE_PROMPT
    if position == "first":
        system += _OPENING_NOTE
    elif position == "last":
        system += _CLOSING_NOTE
    elif position == "only":
        system += _OPENING_NOTE + _CLOSING_NOTE
    # Для не-первых кусков даём модели хвост предыдущего фрагмента, чтобы
    # речь была цельной: без повторного приветствия и одинаковых связок.
    if prev_tail and position not in ("first", "only"):
        system += _CONTINUITY_NOTE.replace("{tail}", prev_tail.strip()[-400:])
    if BLOG_TTS_FISH_TAGS:
        system += _FISH_TAGS_NOTE
    resp = await client.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
        json={
            "model": DEEPSEEK_MODEL,
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": segment},
            ],
        },
        timeout=120.0,
    )
    resp.raise_for_status()
    body = resp.json()
    out = (body.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    try:
        from services.api_usage import log_llm_usage, extract_deepseek_tokens
        tk = extract_deepseek_tokens(body)
        asyncio.create_task(log_llm_usage(
            provider="deepseek", model=DEEPSEEK_MODEL,
            input_tokens=tk[0], output_tokens=tk[1],
            feature="tts.lecture_rewrite",
        ))
    except Exception:
        pass
    return out


def _shield_pauses(text: str) -> str:
    """Прячет метки пауз от нормализации чисел.

    normalize_numbers переводит в слова ВСЕ цифры подряд — включая цифру
    внутри метки: «[ПАУЗА 6]» превращалась в «[ПАУЗА шесть]». Такой маркер
    разрезка пауз уже не узнаёт, а чистильщик инлайн-меток молча вырезает —
    и все паузы исчезали из озвучки без единой ошибки в логах. Ровно это
    случилось при первой же переозвучке лекции с авторскими паузами.

    Плейсхолдер без цифр и скобок: секунды закодированы числом букв «х».
    """
    def enc(m):
        try:
            sec = int(m.group(1)) if m.group(1) else PAUSE_DEFAULT
        except (TypeError, ValueError):
            sec = PAUSE_DEFAULT
        sec = max(PAUSE_MIN, min(PAUSE_MAX, sec))
        return "\x00пауза" + "х" * sec + "\x00"
    return _PAUSE_RE.sub(enc, text)


def _unshield_pauses(text: str) -> str:
    return re.sub("\x00пауза(х+)\x00",
                  lambda m: "[ПАУЗА %d]" % len(m.group(1)), text)


def _plain_speech(text: str) -> str:
    """Фолбэк без LLM: заголовки — в связки с паузами, числа — словами."""
    text = re.sub(r"\n?§ ([^\n]+)\n?", r". … \1 … ", text)
    # Метки пауз прячем до любых замен: replace("]", "") ниже отрезал бы
    # им скобку, а normalize_numbers — превратил бы секунды в слова.
    text = _shield_pauses(text)
    text = text.replace("[СХЕМА: ", "На странице лекции есть схема: ").replace("]", "")
    try:
        from services.voice_service import normalize_numbers
        text = normalize_numbers(text)
    except Exception as e:
        logger.warning(f"blog-tts: normalize_numbers unavailable: {e}")
    text = _unshield_pauses(text)
    return re.sub(r"\s+", " ", text).strip()


async def _prepare_speech(text: str, slug: str) -> str:
    """Готовит текст к синтезу: лекции проходят LLM-рерайт в устную речь,
    остальное — детерминированную нормализацию. Любая ошибка LLM —
    тихий откат на нормализацию."""
    want_rewrite = (
        BLOG_TTS_REWRITE == "all"
        or (BLOG_TTS_REWRITE == "lectures" and slug.startswith("lekciya-"))
    )
    if not (want_rewrite and DEEPSEEK_API_KEY):
        return _plain_speech(text)

    # режем по границам разделов, чтобы сегменты были связными
    raw_parts = re.split(r"(?=\n§ )", text)
    segments, cur = [], ""
    for p in raw_parts:
        if len(cur) + len(p) > 6000 and cur:
            segments.append(cur)
            cur = p
        else:
            cur += p
    if cur:
        segments.append(cur)

    try:
        out = []
        prev_tail = ""
        async with httpx.AsyncClient(timeout=150) as client:
            for i, seg in enumerate(segments):
                if len(segments) == 1:
                    pos = "only"
                elif i == 0:
                    pos = "first"
                elif i == len(segments) - 1:
                    pos = "last"
                else:
                    pos = ""
                piece = await _deepseek_rewrite(client, seg, pos, prev_tail=prev_tail)
                out.append(piece)
                if piece:
                    prev_tail = piece[-400:]
        speech = "\n\n".join(x for x in out if x)
        if len(speech) < len(text) * 0.4:
            raise ValueError("rewrite suspiciously short")
        if len(speech) > len(text) * 2.5:
            # Аномально длинный рерайт — признак «воды» или зацикливания.
            raise ValueError("rewrite suspiciously long")
        # Детерминированная страховка: даже после LLM прогоняем числа/единицы
        # через normalize_numbers — ловим то, что модель оставила цифрами.
        # Метки пауз на это время прячем: иначе «[ПАУЗА 6]» становилась
        # «[ПАУЗА шесть]», разрезка её не узнавала — и вся тишина пропадала.
        try:
            from services.voice_service import normalize_numbers
            speech = _unshield_pauses(normalize_numbers(_shield_pauses(speech)))
        except Exception as e:
            logger.warning(f"blog-tts {slug}: post-rewrite normalize_numbers unavailable: {e}")
        logger.info(f"blog-tts {slug}: lecture rewrite {len(text)} -> {len(speech)} chars, {len(segments)} segments")
        return speech
    except Exception as e:
        logger.warning(f"blog-tts {slug}: rewrite failed ({e}), using plain speech")
        return _plain_speech(text)


def _chunks(text: str, limit: int = CHUNK_LIMIT):
    """Режет текст на куски ≤ limit по границам предложений."""
    out, cur = [], ""
    for sent in re.split(r"(?<=[.!?;]) +", text):
        if len(cur) + len(sent) + 1 > limit:
            if cur:
                out.append(cur)
            while len(sent) > limit:  # аномально длинное «предложение»
                out.append(sent[:limit])
                sent = sent[limit:]
            cur = sent
        else:
            cur = (cur + " " + sent).strip()
    if cur:
        out.append(cur)
    return out


# Инлайн-метки Fish в квадратных скобках ([pause], [long pause], [warm]…).
_INLINE_TAG_RE = re.compile(r"\[[^\]\n]{1,40}\]")

# ===== Настоящие паузы =====
# Лекции всё время просят слушателя что-то сделать в уме: «назовите три
# подписки», «вспомните последний разговор», «скажите фразу вслух пять раз».
# В тексте это работает — глаз останавливается сам. В звуке не работало вовсе:
# диктор шёл дальше через полторы секунды, и приглашение превращалось в
# риторическую фигуру. Многоточие, на которое рассчитывала методичка, синтезатор
# отыгрывает долями секунды — вспомнить за это время нельзя.
# Поэтому пауза делается не интонацией, а тишиной: режиссёр ставит в тексте
# метку [ПАУЗА N], синтез режет речь по ней и вклеивает N секунд молчания.
# Верхняя граница ходила от 8 к 20 и вернулась к 10. Двадцать секунд тишины
# решали задачу «дать подумать» неудачно с обеих сторон: тому, кому хватило
# трёх секунд, оставшиеся семнадцать кажутся обрывом записи, а тому, кому
# нужна минута, и двадцати мало — он всё равно тянется к паузе. Поэтому
# тишина теперь короткая, а время слушатель берёт сам: после каждой паузы
# звучит приглашение остановить запись (RESUME_LINE ниже). Длинные паузы
# ставит автор в HTML (span.pause); режиссёр по промту ограничен 3/5/8.
PAUSE_MIN, PAUSE_MAX, PAUSE_DEFAULT = 2, 10, 5

# Фраза после каждой паузы. Слушателя, которому нужно больше времени, тишина
# любой длины не спасёт — спасёт разрешение остановиться: кнопка паузы у него
# в руках, а мысль о том, что ей можно пользоваться, приходит не всем.
RESUME_LINE = ("Если нужно ещё время, остановите запись и вернитесь, "
               "когда будете готовы. А мы идём дальше.")
# Не больше пауз, чем есть смысла: в лекции на двадцать минут их уместно
# несколько, а не через фразу. Лишние срезаем, оставляя первые. Второй
# предохранитель — на суммарную тишину: модель, которой понравился приём,
# способна наставить меток столько, что лекция превратится в молчание.
# 14, а не 10: лекция с полной лестницей заданий легитимно несёт 11 авторских
# пауз (замер из трёх решений — уже четыре), и десятка молча срезала последнюю —
# паузу задания недели. Объём тишины держит секундный кэп ниже.
PAUSE_LIMIT = 14
PAUSE_TOTAL_MAX = 150

# Кадр MPEG1 Layer III, 128 кбит/с, 44100 Гц, моно. Обнулённый side info
# означает part2_3_length = 0: данных нет, декодер выдаёт тишину. Резервуар бит
# не задействован, поэтому кадр самодостаточен.
#
# ВАЖНО: этот кадр — только запасной. Формат тишины обязан совпадать с форматом
# соседней речи, иначе на стыке меняется частота дискретизации, и декодер
# браузера не переживает смену посреди потока: воспроизведение встаёт ровно там,
# где начинается пауза, и голос уже не возвращается. Проверено в Chromium:
# однородный файл играет до конца, файл со сменой 48000 → 44100 останавливается
# на стыке и отдаёт media error. Синтез отдаёт 48000 Гц, а кадр ниже — 44100,
# поэтому пауза ломала лекцию ровно в том месте, ради которого её ставили.
_SILENT_FRAME = bytes([0xFF, 0xFB, 0x90, 0xC0]) + bytes(417 - 4)
_FRAME_SECONDS = 1152.0 / 44100.0


def _frame_geometry(header: bytes):
    """(частота, размер кадра, секунд в кадре) по четырём байтам заголовка."""
    h1, h2 = header[1], header[2]
    mpeg1 = (h1 & 0x18) == 0x18
    br_i, sr_i = h2 >> 4, (h2 >> 2) & 3
    if br_i in (0, 15) or sr_i == 3:
        raise ValueError("битый заголовок кадра")
    sr = _MP3_SR[sr_i] if mpeg1 else _MP3_SR[sr_i] // 2
    size = (144 if mpeg1 else 72) * _MP3_BR[br_i] * 1000 // sr
    samples = 1152 if mpeg1 else 576
    return sr, size, samples / float(sr)


def _silence_like(header: bytes, seconds: float) -> bytes:
    """Тишина в том же формате, что и переданный кадр речи.

    Копируется всё, что декодер считает форматом потока: версия, слой,
    частота, режим каналов и битрейт. Меняется только содержимое — нули,
    то есть молчание.
    """
    try:
        _, size, per_frame = _frame_geometry(header)
    except Exception:
        return _SILENT_FRAME * max(1, int(round(seconds / _FRAME_SECONDS)))
    frame = bytes(header[:3]) + bytes([header[3]]) + bytes(size - 4)
    return frame * max(1, int(round(seconds / per_frame)))


def _first_frame_header(data: bytes) -> bytes:
    """Заголовок первого звукового кадра куска синтеза."""
    frames = _mp3_frames(data)
    return data[frames[0][0]:frames[0][0] + 4] if frames else b""


def _silence_mp3(seconds: float, like: bytes = b"") -> bytes:
    """Тишина заданной длины. like — заголовок кадра соседней речи."""
    if like:
        return _silence_like(like, seconds)
    return _SILENT_FRAME * max(1, int(round(seconds / _FRAME_SECONDS)))


def _split_pauses(speech: str) -> list:
    """Разбирает речь на куски: ('text', …) и ('pause', секунды).

    Метки приходят от режиссёра, поэтому длину зажимаем в разумные рамки и
    ограничиваем количество — модель, которой понравился приём, способна
    наставить их через предложение.

    За каждой паузой идёт RESUME_LINE: короткая тишина плюс разрешение
    остановить запись работает лучше, чем длинная тишина без него.
    """
    out, pos, used, quiet = [], 0, 0, 0
    for m in _PAUSE_RE.finditer(speech):
        head = speech[pos:m.start()]
        pos = m.end()
        if head.strip():
            out.append(("text", head))
        if used >= PAUSE_LIMIT or quiet >= PAUSE_TOTAL_MAX:
            continue
        try:
            sec = int(m.group(1)) if m.group(1) else PAUSE_DEFAULT
        except (TypeError, ValueError):
            sec = PAUSE_DEFAULT
        sec = max(PAUSE_MIN, min(PAUSE_MAX, sec))
        out.append(("pause", sec))
        out.append(("text", RESUME_LINE))
        used += 1
        quiet += sec
    tail = speech[pos:]
    if tail.strip():
        out.append(("text", tail))
    return out or [("text", speech)]



def _strip_inline_tags(text: str) -> str:
    """Убирает управляющие Fish-метки из текста. Обязательно перед синтезом
    Яндексом (он бы прочитал их вслух) и на Fish-ветке, когда теги выключены."""
    return re.sub(r"\s{2,}", " ", _INLINE_TAG_RE.sub(" ", text)).strip()


# ===== Санитария склеенного mp3 =====
# Файл лекции — склейка кусков синтеза и кадров тишины. Каждый кусок Fish
# проходит через ffmpeg (замедление atempo) и несёт свой ID3-тег и Info-кадр.
# Первый Info в файле объявляет плееру длительность ПЕРВОГО куска: на
# 13-минутную лекцию — «1 мин 35 с». Плееры, верящие заголовку (iOS в том
# числе), видят обрубок. Поэтому после склейки файл пересобирается: весь
# метамусор вычищается, впереди встаёт один Xing-кадр на весь файл — с точным
# числом кадров и таблицей перемотки.

_MP3_BR = {1: 32, 2: 40, 3: 48, 4: 56, 5: 64, 6: 80, 7: 96, 8: 112,
           9: 128, 10: 160, 11: 192, 12: 224, 13: 256, 14: 320}
_MP3_SR = {0: 44100, 1: 48000, 2: 32000}
# Версия санитарии в мете: файлы без неё лечатся лениво при первой отдаче.
MP3_SAN_VERSION = 2


def _mp3_frames(data: bytes) -> list:
    """Разбирает поток на звуковые кадры MPEG Layer III: [(offset, size), …].
    ID3-теги, Xing/Info-кадры и прочий не-кадровый мусор пропускает."""
    out, i, n = [], 0, len(data)
    while i + 4 <= n:
        # ID3v2: 'ID3' + версия(2) + флаги(1) + synchsafe-длина(4)
        if data[i:i + 3] == b"ID3" and i + 10 <= n:
            sz = ((data[i + 6] & 0x7F) << 21 | (data[i + 7] & 0x7F) << 14 |
                  (data[i + 8] & 0x7F) << 7 | (data[i + 9] & 0x7F))
            i += 10 + sz
            continue
        if data[i:i + 3] == b"TAG" and n - i == 128:   # ID3v1 в хвосте
            break
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            i += 1
            continue
        h1, h2 = data[i + 1], data[i + 2]
        if (h1 & 0x06) != 0x02:                        # только Layer III
            i += 1
            continue
        br_i, sr_i, pad = h2 >> 4, (h2 >> 2) & 3, (h2 >> 1) & 1
        if br_i in (0, 15) or sr_i == 3:
            i += 1
            continue
        mpeg1 = (h1 & 0x18) == 0x18
        sr = _MP3_SR[sr_i] if mpeg1 else _MP3_SR[sr_i] // 2
        size = (144 if mpeg1 else 72) * _MP3_BR[br_i] * 1000 // sr + pad
        if size < 24 or i + size > n:
            i += 1
            continue
        # Xing/Info-кадр: валидный кадр, но внутри метаданные, не звук.
        # Магия стоит сразу после side info, чей размер зависит от моно/стерео.
        mono = (data[i + 3] >> 6) == 3
        side = (17 if mono else 32) if mpeg1 else (9 if mono else 17)
        magic = data[i + 4 + side:i + 4 + side + 4]
        if magic in (b"Xing", b"Info"):
            i += size
            continue
        out.append((i, size))
        i += size
    return out


def _build_xing(template: bytes, n_frames: int, total_bytes: int,
                offsets: list) -> bytes:
    """Собирает Xing-кадр по образцу первого звукового кадра: та же версия,
    частота и режим каналов, чтобы декодер не увидел смены формата."""
    h1 = template[1]
    mpeg1 = (h1 & 0x18) == 0x18
    sr_i = (template[2] >> 2) & 3
    sr = _MP3_SR[sr_i] if mpeg1 else _MP3_SR[sr_i] // 2
    mono = (template[3] >> 6) == 3
    side = (17 if mono else 32) if mpeg1 else (9 if mono else 17)
    need = 4 + side + 4 + 4 + 4 + 4 + 100
    # Битрейт кадра-заголовка подбираем так, чтобы всё влезло.
    br_i = template[2] >> 4
    while (144 if mpeg1 else 72) * _MP3_BR[br_i] * 1000 // sr < need and br_i < 14:
        br_i += 1
    size = (144 if mpeg1 else 72) * _MP3_BR[br_i] * 1000 // sr
    frame = bytearray(size)
    frame[0] = 0xFF
    frame[1] = h1
    frame[2] = (br_i << 4) | (sr_i << 2)               # без padding/private
    frame[3] = template[3]
    pos = 4 + side
    frame[pos:pos + 4] = b"Xing"
    frame[pos + 4:pos + 8] = (7).to_bytes(4, "big")     # frames + bytes + TOC
    frame[pos + 8:pos + 12] = n_frames.to_bytes(4, "big")
    frame[pos + 12:pos + 16] = (total_bytes + size).to_bytes(4, "big")
    total = total_bytes + size
    for k in range(100):
        idx = min(n_frames - 1, n_frames * k // 100)
        off = size + offsets[idx]
        frame[pos + 16 + k] = min(255, off * 256 // total)
    return bytes(frame)


def _split_frames(data: bytes) -> list:
    """Режет кусок обратно на отдельные кадры: _retune_silence возвращает
    целые пачки тишины, а Xing считает кадры и смещения поштучно."""
    return [data[off:off + size] for off, size in _mp3_frames(data)]


def _fmt_key(header: bytes):
    """То, что декодер считает форматом потока: версия, слой, частота, каналы.
    Битрейт сюда не входит — его смену внутри mp3 декодеры переносят спокойно."""
    return (header[1] & 0x1E, (header[2] >> 2) & 3, header[3] >> 6)


def _is_silent_frame(chunk: bytes) -> bool:
    """Кадр-тишина: заголовок и дальше нули — ни side info, ни данных."""
    return not any(chunk[4:])


def _retune_silence(chunks: list) -> list:
    """Переписывает кадры тишины в формат остальной лекции.

    Тишину когда-то вклеивали жёстко заданным кадром на 44100 Гц, а синтез
    отдаёт 48000. Для декодера это смена формата посреди потока: лекция
    встаёт ровно на паузе, и голос уже не возвращается. Здесь такие кадры
    заменяются на тишину той же длины в господствующем формате файла —
    поэтому уже записанные лекции чинятся при первой же отдаче, без
    переозвучки.
    """
    speech = [c for c in chunks if not _is_silent_frame(c)]
    if not speech:
        return chunks
    main = collections.Counter(_fmt_key(c) for c in speech).most_common(1)[0][0]
    ref = next(c for c in speech if _fmt_key(c) == main)
    out, bad, sec = [], 0, 0.0
    for c in chunks:
        if _is_silent_frame(c) and _fmt_key(c) != main:
            bad += 1
            sec += _frame_geometry(c[:4])[2]
            continue
        if bad:
            out.append(_silence_like(ref[:4], sec))
            bad, sec = 0, 0.0
        out.append(c)
    if bad:
        out.append(_silence_like(ref[:4], sec))
    return out


def _sanitize_mp3(data: bytes) -> bytes:
    """Пересобирает склейку в честный поток: только звуковые кадры, тишина в
    формате речи и один правильный Xing впереди. При любой странности
    возвращает исходные байты — хуже, чем было, не сделает."""
    try:
        frames = _mp3_frames(data)
        if len(frames) < 10:
            return data
        chunks = [data[off:off + size] for off, size in frames]
        # Тишину чужого формата перекладываем в формат речи, и только потом
        # считаем смещения: длина файла после этого меняется.
        chunks = _retune_silence(chunks)
        chunks = [c for part in chunks for c in _split_frames(part)]
        offsets, acc = [], 0
        for c in chunks:
            offsets.append(acc)
            acc += len(c)
        xing = _build_xing(chunks[0][:4], len(chunks), acc, offsets)
        return xing + b"".join(chunks)
    except Exception as e:
        logger.warning(f"mp3 sanitize failed: {e}")
        return data


async def _synth_yandex(client: httpx.AsyncClient, text: str) -> bytes:
    text = _strip_inline_tags(text)
    resp = await client.post(
        TTS_URL,
        headers={"Authorization": f"Api-Key {YANDEX_API_KEY}"},
        data={
            "text": text,
            "lang": "ru-RU",
            "voice": BLOG_TTS_VOICE,
            "speed": BLOG_TTS_SPEED,
            "format": "mp3",
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.content


def _join_parts(parts: list) -> bytes:
    """Склеивает куски синтеза, подставляя тишину в формате соседней речи.

    Паузы приходят сюда метками ("pause", секунды), потому что их формат
    известен только когда собраны куски вокруг: тишина обязана совпадать с
    речью по частоте и режиму каналов. Берём формат предыдущего куска, а для
    паузы в самом начале — следующего.
    """
    heads = [_first_frame_header(p) if isinstance(p, bytes) else b""
             for p in parts]
    out = []
    for i, part in enumerate(parts):
        if isinstance(part, bytes):
            out.append(part)
            continue
        like = b""
        for j in range(i - 1, -1, -1):
            if heads[j]:
                like = heads[j]
                break
        if not like:
            for j in range(i + 1, len(parts)):
                if heads[j]:
                    like = heads[j]
                    break
        out.append(_silence_mp3(part[1], like))
    return b"".join(out)


async def _synth_all(client: httpx.AsyncClient, speech: str, slug: str):
    """Озвучивает весь текст ОДНИМ голосом: сначала пробуем Fish (голос Фреди),
    и если он споткнулся на любом куске — переозвучиваем всё Яндексом целиком,
    чтобы голос не менялся посреди лекции.
    Возвращает (mp3, provider, fish_error) — третье поле заполнено, когда
    хотели Fish, а не вышло: причина последнего отказа для меты и статуса.

    Метки [ПАУЗА N] не доходят ни до одного синтезатора: речь режется по ним, а
    на их место встаёт настоящая тишина. Синтезаторы паузами не управляют — они
    читают знаки препинания, а знак препинания короче секунды.
    """
    pieces = _split_pauses(speech)
    pauses = sum(1 for kind, _ in pieces if kind == "pause")
    quiet = sum(v for kind, v in pieces if kind == "pause")
    if pauses:
        logger.info("blog-tts %s: пауз %d, тишины %d сек", slug, pauses, quiet)

    fish_err = None
    if BLOG_TTS_PROVIDER == "fish":
        from services import fish_audio_service as fish_svc
        from services.fish_audio_service import synthesize_fish_audio, fish_configured
        if not fish_configured():
            # Нет ключа/голоса Фреди — не сыпем страшными варнингами на каждый
            # кусок, честно уходим в Яндекс и пишем это один раз.
            logger.warning(f"blog-tts {slug}: Fish не настроен (нет FISH_AUDIO_API_KEY/VOICE_ID), озвучиваю Яндексом")
            fish_err = "not_configured"
        else:
            # Считаем куски заранее: лекция в 12 тысяч знаков — это ~9 кусков,
            # и вероятность «хотя бы один не выйдет» растёт с длиной. Именно
            # длинные лекции и падали в Яндекс — по одному невезучему куску.
            chunks_total = sum(
                1 for kind, val in pieces if kind == "text"
                for _ in _chunks(val, FISH_CHUNK_LIMIT)
            )
            try:
                parts, chunk_no = [], 0
                for kind, val in pieces:
                    if kind == "pause":
                        # Формат тишины подставим потом, когда будет известен
                        # формат соседней речи: несовпадение частоты роняет
                        # декодер ровно на стыке.
                        parts.append(("pause", val))
                        continue
                    for ch in _chunks(val, FISH_CHUNK_LIMIT):
                        chunk_no += 1
                        # Метки оставляем только если они включены (S2/S2.1); иначе
                        # вырезаем, чтобы Fish случайно не прочитал их вслух.
                        ch_fish = ch if BLOG_TTS_FISH_TAGS else _strip_inline_tags(ch)
                        if not ch_fish.strip():
                            continue
                        # Случайный сбой (таймаут, 5xx) гасим повторами с
                        # нарастающей паузой. Безнадёжный (нет баланса) не
                        # мучаем: сразу в Яндекс, деньги Fish не жжём.
                        audio = None
                        for attempt, wait in enumerate((0, 3, 10, 25)):
                            if wait:
                                logger.info(
                                    f"blog-tts {slug}: Fish не ответил на кусок "
                                    f"{chunk_no}/{chunks_total} ({fish_svc.last_fail}), "
                                    f"попытка {attempt + 1} через {wait}с")
                                await asyncio.sleep(wait)
                            audio = await synthesize_fish_audio(ch_fish, timeout=FISH_TIMEOUT)
                            if audio or fish_svc.last_fail == "no_balance":
                                break
                        if not audio:
                            fish_err = fish_svc.last_fail or "empty_audio"
                            raise RuntimeError(
                                f"кусок {chunk_no}/{chunks_total}: {fish_err}")
                        parts.append(audio)
                return _join_parts(parts), "fish", None
            except Exception as e:
                fish_err = fish_err or f"error: {str(e)[:120]}"
                logger.warning(f"blog-tts {slug}: fish failed ({e}), re-voicing whole article via yandex")

    parts = []
    for kind, val in pieces:
        if kind == "pause":
            parts.append(("pause", val))
            continue
        for ch in _chunks(val, CHUNK_LIMIT):
            if ch.strip():
                parts.append(await _synth_yandex(client, ch))
    return _join_parts(parts), "yandex", fish_err


# ===== Кэш: mp3 + мета о том, чем и как он озвучен =====

# ---------------------------------------------------------------------------
# Подписанные ссылки на mp3
#
# Раньше адрес озвучки был угадываемым: /api/tts/blog/<slug>.mp3 — его можно
# было скопировать из инспектора, открыть в новой вкладке и сохранить файл,
# а заодно вставить на чужой сайт. Теперь ссылка живёт ограниченное время и
# подписана HMAC от slug.
#
# Срок не «от момента выдачи», а по временнОму окну (bucket): внутри окна
# адрес не меняется, поэтому браузер по-прежнему берёт mp3 из кэша, а не
# качает его заново на каждое открытие страницы. Скопированная ссылка умирает
# максимум через 2×LINK_TTL.
LINK_TTL = 6 * 3600
# Хосты, с которых аудио разрешено играть. Ссылка, открытая прямо в адресной
# строке, Referer не шлёт — такой запрос без подписи не проходит.
ALLOWED_REFERERS = ("meysternlp.ru", "www.meysternlp.ru", "localhost", "127.0.0.1")
# Пока по сайту гуляет старый закэшированный listen.js, запрос без подписи, но
# с нашего домена, пропускаем. Выключается BLOG_TTS_LINK_GRACE=0.
LINK_GRACE = os.getenv("BLOG_TTS_LINK_GRACE", "1").strip().lower() in ("1", "true", "yes", "on")

_link_secret_cache = None


def _link_secret() -> bytes:
    """Ключ подписи. Берём из env, иначе заводим случайный и кладём на диск
    рядом с mp3 — иначе после каждого редеплоя все выданные ссылки сгорали бы,
    а вместе с ними и проигрывание у тех, кто слушает прямо сейчас."""
    global _link_secret_cache
    if _link_secret_cache:
        return _link_secret_cache
    env = (os.getenv("BLOG_TTS_LINK_SECRET") or "").strip()
    if env:
        _link_secret_cache = env.encode()
        return _link_secret_cache
    path = os.path.join(TTS_DIR, ".link_secret")
    try:
        with open(path, "rb") as f:
            data = f.read().strip()
        if len(data) >= 32:
            _link_secret_cache = data
            return data
    except Exception:
        pass
    data = binascii.hexlify(os.urandom(32))
    try:
        os.makedirs(TTS_DIR, exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        os.chmod(path, 0o600)
    except Exception as e:
        logger.warning(f"blog-tts: ключ подписи ссылок не сохранён ({e}), "
                       f"ссылки сгорят при рестарте")
    _link_secret_cache = data
    return data


def _link_sign(slug: str, exp: int) -> str:
    mac = hmac.new(_link_secret(), f"{slug}|{exp}".encode(), hashlib.sha256)
    return mac.hexdigest()[:24]


def _link_params(slug: str) -> tuple:
    """(exp, sig) для текущего окна."""
    exp = (int(time.time()) // LINK_TTL + 2) * LINK_TTL
    return exp, _link_sign(slug, exp)


def _link_ok(slug: str, exp: str, sig: str) -> bool:
    try:
        e = int(exp)
    except (TypeError, ValueError):
        return False
    now = int(time.time())
    if not (now < e <= now + 2 * LINK_TTL):
        return False
    return hmac.compare_digest(_link_sign(slug, e), (sig or "").strip())


def _from_site(request: Request) -> bool:
    """Запрос пришёл со страницы сайта, а не из адресной строки/качалки."""
    src = request.headers.get("origin") or request.headers.get("referer") or ""
    if not src:
        return False
    host = re.sub(r"^\w+://", "", src).split("/")[0].split(":")[0].lower()
    return host in ALLOWED_REFERERS


def _meta_path(slug: str) -> str:
    return os.path.join(TTS_DIR, f"{slug}.meta.json")


def _read_meta(slug: str) -> dict:
    try:
        with open(_meta_path(slug), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _cache_ok(slug: str) -> bool:
    """Есть готовый непустой mp3 — кэш валиден, НЕ переозвучиваем.
    Главное правило: не платить Fish дважды за то, что уже озвучено. Раньше
    расхождение версии пайплайна/провайдера или «деградированный» (Яндекс
    вместо Фреди) файл спустя несколько часов заставляли синтез идти
    заново — и это стоило денег на каждый апдейт. Теперь перегенерация — только
    по явному запросу админа (force). Поля v/provider в мете остаются для
    информации (их показывает статус), но сами перегенерацию не запускают."""
    path = os.path.join(TTS_DIR, f"{slug}.mp3")
    return os.path.exists(path) and os.path.getsize(path) > 1000


async def _generate(slug: str) -> str:
    """Скачивает статью, синтезирует и кладёт mp3 в кэш. Возвращает путь."""
    os.makedirs(TTS_DIR, exist_ok=True)
    path = os.path.join(TTS_DIR, f"{slug}.mp3")
    if _cache_ok(slug):
        return path

    async with httpx.AsyncClient(timeout=30) as client:
        page = await client.get(f"{SITE_BASE}/blog/{slug}.html")
        if page.status_code != 200:
            raise FileNotFoundError(f"article {slug} -> {page.status_code}")
        text = _extract_text(page.text)
        if len(text) < 200:
            raise ValueError(f"article {slug}: extracted text too short")

        speech = await _prepare_speech(text, slug)
        # сценарий сохраняем рядом с mp3 — для отладки и переозвучки
        try:
            with open(os.path.join(TTS_DIR, f"{slug}.txt"), "w", encoding="utf-8") as tf:
                tf.write(speech)
        except Exception:
            pass

        logger.info(f"blog-tts {slug}: {len(speech)} chars speech, provider={BLOG_TTS_PROVIDER}")
        audio, used, fish_err = await _synth_all(client, speech, slug)
        audio = await asyncio.to_thread(_sanitize_mp3, audio)

    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(audio)
    os.replace(tmp, path)
    try:
        with open(_meta_path(slug), "w", encoding="utf-8") as mf:
            meta_out = {
                "v": TTS_CACHE_VERSION, "provider": used, "wanted": BLOG_TTS_PROVIDER,
                "ts": time.time(), "chars": len(speech), "san": MP3_SAN_VERSION,
            }
            if used == "fish":
                # какой моделью синтезировано: пусто = «модель Fish по
                # умолчанию», а она у них меняется, и голос вместе с ней
                meta_out["fish_model"] = os.getenv("FISH_AUDIO_MODEL", "").strip() or "default"
            elif fish_err:
                # почему НЕ Фреди: без этого деградацию видно, а причину — нет,
                # и каждый раз приходится гадать между балансом и таймаутом
                meta_out["fish_error"] = fish_err
            json.dump(meta_out, mf)
    except Exception:
        pass

    if used != "fish":
        # Fish логирует расход сам внутри synthesize_fish_audio
        try:
            from services.api_usage import log_tts_usage
            asyncio.create_task(log_tts_usage(
                provider="yandex", model=BLOG_TTS_VOICE,
                chars=len(speech), feature="tts.blog_article",
            ))
        except Exception:
            pass

    logger.info(f"blog-tts {slug}: saved {len(audio)} bytes, voice={used}")
    return path


# ===== Пакетная пре-генерация озвучки (админ) =====
# Состояние последнего/текущего прогона: чтобы не запускать два разом и
# отдавать прогресс. Ключуем по одному глобальному прогону — их не бывает
# много параллельно.
_pregen: dict = {"running": False, "total": 0, "done": 0, "generated": 0,
                 "skipped": 0, "errors": [], "started": 0, "finished": 0,
                 "cancel": False, "cancelled": False}
_LEKCIYA_RE = re.compile(r"/blog/(lekciya-[a-z0-9][a-z0-9-]{2,120})\.html")
_BLOG_RE = re.compile(r"/blog/([a-z0-9][a-z0-9-]{2,120})\.html")


def _uniq_slugs(slugs: list) -> list:
    """Уникализирует слаги, сохраняя порядок и отбрасывая невалидные."""
    seen, out = set(), []
    for s in slugs:
        if s not in seen and SLUG_RE.match(s):
            seen.add(s)
            out.append(s)
    return out


async def _discover_sitemap_slugs() -> tuple:
    """Читает sitemap сайта и возвращает (лекции, все статьи блога).
    Озвучка кэшируется для любой статьи блога, не только для лекций, —
    список в аналитике должен отличать «статью блога» от действительно
    осиротевшего mp3, которого на сайте больше нет."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{SITE_BASE}/sitemap.xml")
        r.raise_for_status()
        text = r.text
    return _uniq_slugs(_LEKCIYA_RE.findall(text)), _uniq_slugs(_BLOG_RE.findall(text))


async def _discover_lecture_slugs() -> list:
    """Собирает слаги всех лекций Лектория из sitemap сайта (lekciya-*)."""
    lectures, _ = await _discover_sitemap_slugs()
    return lectures


def _is_degraded(slug: str) -> bool:
    """Озвучено не тем голосом: хотели Фреди (Fish), а вышел Яндекс.
    Определяется по мете рядом с mp3; без меты судить не берёмся."""
    meta = _read_meta(slug)
    if not meta:
        return False
    return meta.get("wanted") == "fish" and meta.get("provider") not in (None, "fish")


async def _pregenerate_run(slugs: list, force: bool = False):
    """Последовательно озвучивает список слагов, пропуская уже готовые.
    Последовательно — чтобы не разгонять расход Fish и нагрузку на LLM.
    force=True — переозвучить, даже если mp3 уже есть (кнопка «переозвучить»
    у отдельной лекции): удаляем сам mp3 и мету, чтобы _cache_ok перестал
    считать файл годным (теперь он смотрит только на наличие mp3), и
    генерируем заново. Без force готовые пропускаются и Fish не тратится."""
    _pregen.update(running=True, total=len(slugs), done=0, generated=0,
                   skipped=0, errors=[], started=time.time(), finished=0,
                   cancel=False, cancelled=False)
    try:
        for slug in slugs:
            if _pregen["cancel"]:
                # Пакет на восемьсот лекций идёт сутками и всё это время
                # держит очередь занятой. Кнопка «остановить» нужна, чтобы
                # админ мог вклиниться и озвучить нужную лекцию сейчас.
                _pregen["cancelled"] = True
                logger.info("blog-tts pregenerate cancelled at %s/%s",
                            _pregen["done"], _pregen["total"])
                break
            try:
                if _cache_ok(slug) and not force:
                    _pregen["skipped"] += 1
                else:
                    lock = _locks.setdefault(slug, asyncio.Lock())
                    async with lock:
                        if force:
                            for _pth in (os.path.join(TTS_DIR, f"{slug}.mp3"),
                                         _meta_path(slug)):
                                try:
                                    os.remove(_pth)
                                except OSError:
                                    pass
                        if force or not _cache_ok(slug):
                            await _generate(slug)
                            _pregen["generated"] += 1
                        else:
                            _pregen["skipped"] += 1
            except Exception as e:
                logger.warning(f"blog-tts pregenerate {slug} failed: {e}")
                _pregen["errors"].append({"slug": slug, "error": str(e)[:200]})
            finally:
                _pregen["done"] += 1
    finally:
        _pregen.update(running=False, finished=time.time())
        logger.info(
            "blog-tts pregenerate done: generated=%s skipped=%s errors=%s of %s",
            _pregen["generated"], _pregen["skipped"], len(_pregen["errors"]), _pregen["total"],
        )


def _start_single(slug: str, force: bool = False) -> str:
    """Ставит на озвучку одну лекцию — в обход пакетной очереди.

    Раньше кнопка «Сгенерировать» в админке била в pregenerate, а тот
    отвечает 409, пока идёт пакет. Пакет на все неозвученные лекции идёт
    сутками — значит одиночная озвучка была недоступна всё это время, хотя
    технически ничто не мешало: у каждой лекции свой замок, и параллельная
    генерация одной статьи пакету не мешает.

    Возвращает «generating», если эта лекция уже озвучивается, иначе
    «started». Ошибки кладутся в _gen_errors и видны в /status.
    """
    if slug in _gen_tasks:
        return "generating"

    async def _run():
        lock = _locks.setdefault(slug, asyncio.Lock())
        try:
            async with lock:
                if force:
                    # _cache_ok смотрит только на наличие mp3 — чтобы
                    # переозвучить, файл надо убрать вместе с метой
                    for _pth in (os.path.join(TTS_DIR, f"{slug}.mp3"), _meta_path(slug)):
                        try:
                            os.remove(_pth)
                        except OSError:
                            pass
                if force or not _cache_ok(slug):
                    await _generate(slug)
            _gen_errors.pop(slug, None)
        except FileNotFoundError:
            _gen_errors[slug] = "article not found"
        except Exception as e:
            logger.error(f"blog-tts {slug} failed: {e}")
            _gen_errors[slug] = "generation failed"
        finally:
            _gen_tasks.pop(slug, None)

    _gen_errors.pop(slug, None)
    _gen_tasks[slug] = asyncio.create_task(_run())
    return "started"


def register_blog_tts_routes(app, limiter):

    @app.get("/api/tts/blog/{slug}/status")
    @limiter.limit("60/minute")
    async def blog_tts_status(request: Request, slug: str):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"enabled": False}, status_code=400)
        if not _tts_available():
            return {"enabled": False}
        # v меняется при переозвучке: фронт добавляет его к URL,
        # чтобы браузер не играл вечно закэшированный старый голос
        meta = _read_meta(slug)
        try:
            from services.fish_audio_service import fish_configured
            _fish = fish_configured()
        except Exception:
            _fish = False
        # Адрес mp3 выдаётся только здесь и только подписанным: угадать его
        # нельзя, скопированный перестаёт работать через несколько часов.
        exp, sig = _link_params(slug)
        # voice — каким голосом реально озвучен кэш: 'fish' (Фреди) или 'yandex'
        # (запасной). degraded=True, если хотели Фреди, а вышел Яндекс.
        return {
            "enabled": True, "ready": _cache_ok(slug),
            "url": f"/api/tts/blog/{slug}.mp3?e={exp}&s={sig}",
            "e": exp, "s": sig,
            "v": int(meta.get("ts", 0)),
            "voice": meta.get("provider"),
            "fish_model": meta.get("fish_model"),
            "degraded": bool(meta) and meta.get("provider") not in (None, meta.get("wanted")),
            "fish_error": meta.get("fish_error"),
            "fish": _fish,
            "generating": slug in _gen_tasks,
            "error": _gen_errors.get(slug),
        }

    @app.get("/api/tts/blog/{slug}.mp3")
    @limiter.limit("20/minute")
    async def blog_tts_audio(request: Request, slug: str, e: str = "", s: str = ""):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"error": "bad slug"}, status_code=400)
        if not _tts_available():
            return JSONResponse({"error": "tts disabled"}, status_code=503)
        # Играть можно только по подписи, выданной /status минуты назад.
        # Ссылка, открытая в адресной строке или вставленная на чужой сайт,
        # сюда не доходит: подписи нет, Referer чужой или отсутствует.
        if not _link_ok(slug, e, s) and not (LINK_GRACE and _from_site(request)):
            return JSONResponse({"error": "link expired"}, status_code=403)

        path = os.path.join(TTS_DIR, f"{slug}.mp3")
        if not _cache_ok(slug):
            # Генерация лекции (рерайт + синтез) занимает минуты — держать
            # соединение столько нельзя. Запускаем фоном и отвечаем 202,
            # фронт поллит /status и приходит за файлом, когда ready.
            if _gen_errors.get(slug) and slug not in _gen_tasks:
                err = _gen_errors.pop(slug)
                code = 404 if "article" in err else 502
                return JSONResponse({"error": err}, status_code=code)

            _start_single(slug)
            return JSONResponse({"status": "generating"}, status_code=202)

        # Файлы, склеенные до санитарии, лечим при первой отдаче: вычищаем
        # ID3/Info-мусор кусков и ставим честный Xing. Дёшево (без синтеза),
        # одноразово (метка san в мете). Гонка двух запросов безвредна:
        # результат детерминирован, os.replace атомарен.
        meta = _read_meta(slug)
        if meta and meta.get("san") != MP3_SAN_VERSION:
            try:
                with open(path, "rb") as f:
                    raw = f.read()
                fixed = await asyncio.to_thread(_sanitize_mp3, raw)
                tmp = path + ".san"
                with open(tmp, "wb") as f:
                    f.write(fixed)
                os.replace(tmp, path)
                meta["san"] = MP3_SAN_VERSION
                # ts двигаем: v в URL меняется, браузеры перестают играть
                # закэшированную битую склейку с immutable-заголовком
                meta["ts"] = time.time()
                with open(_meta_path(slug), "w", encoding="utf-8") as mf:
                    json.dump(meta, mf)
                logger.info(f"blog-tts {slug}: mp3 пересобран ({len(raw)}→{len(fixed)} байт)")
            except Exception as e:
                logger.warning(f"blog-tts {slug}: санитария не удалась: {e}")

        # private: подписанный адрес не должен оседать в общих кэшах провайдеров.
        # inline — чтобы браузер играл, а не предлагал «Сохранить как».
        common = {"Cache-Control": "private, max-age=31536000, immutable",
                  "Content-Disposition": "inline",
                  "X-Robots-Tag": "noindex, noimageindex",
                  "Accept-Ranges": "bytes"}
        size = os.path.getsize(path)
        # Range обязателен: iOS Safari не начинает играть аудио с сервера,
        # который не умеет 206 (fastapi 0.104 / starlette 0.27 не умеют).
        rng = request.headers.get("range")
        m = re.match(r"bytes=(\d*)-(\d*)\s*$", rng) if rng else None
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:                       # bytes=-N: последние N байт
                start = max(0, size - int(m.group(2)))
                end = size - 1
            end = min(end, size - 1)
            if start > end or start >= size:
                return Response(status_code=416, headers={
                    **common, "Content-Range": f"bytes */{size}"})

            def _slice(p=path, a=start, b=end):
                with open(p, "rb") as f:
                    f.seek(a)
                    left = b - a + 1
                    while left > 0:
                        chunk = f.read(min(256 * 1024, left))
                        if not chunk:
                            break
                        left -= len(chunk)
                        yield chunk

            return StreamingResponse(
                _slice(), status_code=206, media_type="audio/mpeg",
                headers={**common,
                         "Content-Range": f"bytes {start}-{end}/{size}",
                         "Content-Length": str(end - start + 1)})

        return FileResponse(path, media_type="audio/mpeg", headers=common)

    @app.post("/api/tts/blog/{slug}/generate")
    @limiter.limit("30/minute")
    async def blog_tts_generate_one(request: Request, slug: str):
        """Озвучить одну лекцию прямо сейчас, не дожидаясь пакета (админ).

        Тело (необязательно): {"force": true} — переозвучить, даже если mp3
        уже есть. Отвечает сразу: синтез идёт в фоне, прогресс — в /status.
        """
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected:
            return JSONResponse({"error": "admin disabled",
                                 "message": "Задайте ADMIN_TOKEN в env"}, status_code=503)
        if (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return JSONResponse({"error": "forbidden"}, status_code=403)
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"error": "bad slug"}, status_code=400)
        if not _tts_available():
            return JSONResponse({"error": "tts disabled"}, status_code=503)

        try:
            payload = await request.json()
        except Exception:
            payload = {}
        force = bool(payload.get("force")) if isinstance(payload, dict) else False
        if _cache_ok(slug) and not force:
            return {"status": "ready"}
        return JSONResponse({"status": _start_single(slug, force=force)}, status_code=202)

    @app.post("/api/tts/blog/pregenerate/stop")
    @limiter.limit("10/minute")
    async def blog_tts_pregenerate_stop(request: Request):
        """Остановить пакетную озвучку после текущей лекции (админ).

        Уже озвученное остаётся: пакет идемпотентен, повторный запуск
        продолжит с того места, где остановились.
        """
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected or (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return JSONResponse({"error": "forbidden"}, status_code=403)
        if not _pregen["running"]:
            return {"status": "idle", **_pregen}
        _pregen["cancel"] = True
        return {"status": "stopping", **_pregen}

    @app.post("/api/tts/blog/pregenerate")
    @limiter.limit("6/minute")
    async def blog_tts_pregenerate(request: Request):
        """Пакетно пре-генерирует и кэширует озвучку лекций (админ).

        Защита: заголовок X-Admin-Token = env ADMIN_TOKEN.
        Тело (необязательно): {"slugs": ["lekciya-...", ...]} — иначе берём
        все лекции из sitemap. Идемпотентно: уже готовые пропускаются, так что
        Fish не переплачивается. Работает в фоне; прогресс — GET того же пути.
        """
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected:
            return JSONResponse({"error": "admin disabled",
                                 "message": "Задайте ADMIN_TOKEN в env"}, status_code=503)
        if (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return JSONResponse({"error": "forbidden"}, status_code=403)
        if not _tts_available():
            return JSONResponse({"error": "tts disabled"}, status_code=503)
        if _pregen["running"]:
            return JSONResponse({"status": "already_running", **_pregen}, status_code=409)

        try:
            payload = await request.json()
        except Exception:
            payload = {}
        slugs = payload.get("slugs") if isinstance(payload, dict) else None
        force = bool(payload.get("force")) if isinstance(payload, dict) else False
        # only_degraded: переозвучить только то, что ушло в Яндекс вместо Фреди.
        # Дешевле force: уже правильно озвученное Fish не трогаем.
        only_degraded = bool(payload.get("only_degraded")) if isinstance(payload, dict) else False
        if slugs:
            slugs = [s for s in slugs if isinstance(s, str) and SLUG_RE.match(s)]
        else:
            try:
                if only_degraded:
                    lectures, blog = await _discover_sitemap_slugs()
                    slugs = _uniq_slugs(list(lectures) + list(blog))
                else:
                    slugs = await _discover_lecture_slugs()
            except Exception as e:
                return JSONResponse({"error": "discover failed", "detail": str(e)[:200]},
                                    status_code=502)
        if only_degraded:
            slugs = [s for s in slugs if _is_degraded(s)]
            force = True   # иначе готовый mp3 будет пропущен как валидный
        if not slugs:
            return JSONResponse({"error": "no slugs"}, status_code=400)

        asyncio.create_task(_pregenerate_run(slugs, force=force))
        return {"status": "started", "total": len(slugs)}

    @app.get("/api/tts/blog/pregenerate")
    @limiter.limit("60/minute")
    async def blog_tts_pregenerate_status(request: Request):
        """Прогресс последней/текущей пакетной пре-генерации (админ)."""
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected or (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return JSONResponse({"error": "forbidden"}, status_code=403)
        return dict(_pregen)

    @app.get("/api/tts/blog/list")
    @limiter.limit("30/minute")
    async def blog_tts_list(request: Request):
        """Список лекций с состоянием озвучки (админ): что уже записано в mp3,
        каким голосом, размер и дата — со ссылкой на прослушивание/скачивание.
        Порядок — как в sitemap (по публикации); в конец добавляем «осиротевшие»
        mp3, которых уже нет в sitemap, чтобы их было видно и можно было удалить.
        """
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected or (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return JSONResponse({"error": "forbidden"}, status_code=403)

        order, site_slugs = [], set()
        try:
            order, all_blog = await _discover_sitemap_slugs()
            site_slugs = set(all_blog)
        except Exception as e:
            logger.warning(f"blog-tts list: discover failed: {e}")
        seen = set(order)
        articles, orphans = [], set()
        try:
            for fn in os.listdir(TTS_DIR):
                if fn.endswith(".mp3"):
                    s = fn[:-4]
                    if s in seen or not SLUG_RE.match(s):
                        continue
                    seen.add(s)
                    # озвученная статья блога — полноценная запись кэша;
                    # сирота — только mp3, которого в sitemap уже нет
                    if s in site_slugs:
                        articles.append(s)
                    else:
                        orphans.add(s)
        except FileNotFoundError:
            pass
        order += sorted(articles) + sorted(orphans)

        items, ready_n, total_bytes = [], 0, 0
        for slug in order:
            path = os.path.join(TTS_DIR, f"{slug}.mp3")
            exists = os.path.exists(path)
            size = os.path.getsize(path) if exists else 0
            meta = _read_meta(slug)
            ok = _cache_ok(slug)
            if ok:
                ready_n += 1
            total_bytes += size
            items.append({
                "slug": slug,
                "ready": ok,
                "exists": exists,
                "orphan": slug in orphans,
                "kind": ("lecture" if slug.startswith("lekciya-")
                         else ("orphan" if slug in orphans else "article")),
                "voice": meta.get("provider"),
                "fish_model": meta.get("fish_model"),
                "wanted": meta.get("wanted"),
                "degraded": bool(meta) and meta.get("provider") not in (None, meta.get("wanted")),
                "fish_error": meta.get("fish_error"),
                "stale": exists and not ok,
                "bytes": size,
                "chars": meta.get("chars"),
                "ts": meta.get("ts"),
                "url": f"/api/tts/blog/{slug}.mp3",
            })
        return {
            "dir": TTS_DIR,
            "persistent": os.path.abspath(TTS_DIR).startswith("/data"),
            "provider": BLOG_TTS_PROVIDER,
            "total": len(items),
            "ready": ready_n,
            "bytes": total_bytes,
            "running": _pregen["running"],
            "items": items,
        }

    # Диагностика при старте: сразу видно, подхватит ли бэкенд готовые mp3
    # (если TTS_DIR пуст или не тот — озвучка пойдёт заново и «не тем» голосом),
    # и настроен ли Fish-голос Фреди (иначе фолбэк в Яндекс).
    try:
        _mp3_n = len([f for f in os.listdir(TTS_DIR) if f.endswith(".mp3")]) if os.path.isdir(TTS_DIR) else -1
    except Exception:
        _mp3_n = -1
    try:
        from services.fish_audio_service import fish_configured as _fc
        _fish_ok = _fc()
    except Exception:
        _fish_ok = False
    logger.info(
        "Blog TTS routes registered (provider=%s, yandex_voice=%s, enabled=%s, "
        "TTS_DIR=%s, saved_mp3=%s, fish_configured=%s)",
        BLOG_TTS_PROVIDER, BLOG_TTS_VOICE, bool(YANDEX_API_KEY),
        TTS_DIR, _mp3_n, _fish_ok,
    )
    if not YANDEX_API_KEY:
        logger.warning(
            "Blog TTS: НЕТ переменной YANDEX_API_KEY — /status отвечает "
            "enabled=false на КАЖДУЮ лекцию, поэтому фронт по всему сайту "
            "откатывается на браузерный синтез (робот-голос, не Фреди). "
            "Готовые mp3 при этом не отдаются, даже если лежат в TTS_DIR. "
            "Верни YANDEX_API_KEY в env деплоя — это же ключ голоса Фреди.")
    if _mp3_n == 0:
        logger.warning(
            "Blog TTS: в TTS_DIR=%s НЕТ ни одного mp3 — готовые озвучки не видны "
            "приложению, лекции будут озвучиваться заново. Проверь монтирование "
            "постоянного диска (/data) и переменную BLOG_TTS_DIR.", TTS_DIR)
    if BLOG_TTS_PROVIDER == "fish" and not _fish_ok:
        logger.warning(
            "Blog TTS: провайдер fish, но голос Фреди не настроен "
            "(нет FISH_AUDIO_API_KEY/FISH_AUDIO_VOICE_ID) — озвучка уйдёт в Яндекс.")
