# -*- coding: utf-8 -*-
"""Озвучка статей блога голосом Yandex SpeechKit.

Принцип: генерируем ОДИН раз, сохраняем в data/tts_blog/{slug}.mp3
и дальше отдаём файл. Первый слушатель ждёт генерацию (~15–30 сек),
остальные получают мгновенно. Ключ — тот же YANDEX_API_KEY, что и
у голоса Фреди; если ключа нет, эндпоинты честно отвечают disabled,
и фронт откатывается на браузерный синтез.
"""
import asyncio
import html as html_mod
import json
import logging
import os
import re
import time

import httpx
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse

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

# Версия конвейера озвучки. Меняются голос/режиссёр/промт — поднимаем
# на единицу, и закэшированные mp3 переозвучиваются при следующем запросе.
TTS_CACHE_VERSION = 4
# Если Fish был недоступен и лекцию озвучил Яндекс — отдаём этот файл,
# но спустя это время при новом запросе пробуем вернуть голос Фреди.
DEGRADED_RETRY_SECONDS = 6 * 3600

# Блоки, которые не читаем вслух (виджеты, ссылки, служебное)
_SKIP_BLOCK_RE = re.compile(
    r'<div class="(?:selfcheck|fredi-ask-box|game-link-box|related-articles|'
    r'author-block|author-box|cta-block|toc-box)".*?</div>\s*</div>|'
    r'<div class="(?:selfcheck|fredi-ask-box|game-link-box|toc-box)".*?</div>',
    re.S,
)

_locks: dict = {}
_gen_tasks: dict = {}   # slug -> asyncio.Task фоновой генерации
_gen_errors: dict = {}  # slug -> текст последней ошибки генерации


def _extract_text(page: str) -> str:
    """Достаёт из HTML статьи связный текст для озвучки."""
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    title = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""

    body = page
    mc = re.search(r'<div class="article-content">(.*)</div>\s*\n*<div class="cta-block">', page, re.S)
    if not mc:
        mc = re.search(r'<div class="article-content">(.*?)<div class="related-articles">', page, re.S)
    if mc:
        body = mc.group(1)

    # выкидываем скрипты/стили и нечитаемые блоки
    body = re.sub(r"<script.*?</script>", " ", body, flags=re.S)
    body = re.sub(r"<style.*?</style>", " ", body, flags=re.S)
    for _ in range(3):
        body = _SKIP_BLOCK_RE.sub(" ", body)

    # подписи к схемам/иллюстрациям -> маркер для лектора,
    # оставленный на своём месте в потоке текста
    def _cap_to_marker(cm):
        c = re.sub(r"<[^>]+>", " ", cm.group(1))
        c = re.sub(r"\s+", " ", html_mod.unescape(c)).strip()
        return "<p>[СХЕМА: " + c + "]</p>" if c else " "

    body = re.sub(r"<figcaption[^>]*>(.*?)</figcaption>", _cap_to_marker, body, flags=re.S)
    # сами SVG-схемы диктору не нужны (и их <polygon>/<line> не должны
    # ловиться регэкспом как <p>/<li>)
    body = re.sub(r"<svg.*?</svg>", " ", body, flags=re.S)

    parts = [title + "."] if title else []
    for tag_m in re.finditer(r"<(h2|h3|p|li)(?=[\s>])[^>]*>(.*?)</\1>", body, re.S):
        tag = tag_m.group(1)
        t = re.sub(r"<[^>]+>", " ", tag_m.group(2))
        t = html_mod.unescape(t)
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) < 3:
            continue
        # эмодзи и прочие пиктограммы диктору не нужны
        t = re.sub(
            "[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]", "", t
        ).strip()
        if not t:
            continue
        if not t.endswith((".", "!", "?", ":", ";")):
            t += "."
        # заголовки помечаем — дальше их превратит в речевые переходы
        # либо LLM-рерайт, либо простая замена в _plain_speech
        if tag in ("h2", "h3"):
            t = "\n§ " + t + "\n"
        parts.append(t)
    text = " ".join(parts)
    return text[:MAX_ARTICLE_CHARS]


# ===== Подготовка речи: из текста статьи — в устную лекцию =====

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
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
    "7) Вопросы для самопроверки оформи как финальное обращение: «А теперь — вопросы, "
    "над которыми стоит подумать…». Список литературы сократи до одной фразы-рекомендации.\n"
    "8) Пометки вида [СХЕМА: …] означают иллюстрацию на странице лекции: сошлись на неё "
    "естественно («если вы открыли лекцию на экране — взгляните на схему: …») и перескажи её суть "
    "словами, чтобы слушателю без экрана тоже было понятно.\n"
    "9) Аббревиатуры (КПТ, НЛП, СДВГ, ЭИ, IQ) при первом упоминании расшифруй словами; если "
    "расшифровка громоздкая — произнеси по буквам так, как это звучит вслух («ка-пэ-тэ»). "
    "Латиницу и иностранные вкрапления (vs, etc., PhD, IQ) замени русским словом или транскрипцией — "
    "в озвучке не должно остаться латинских букв.\n"
    "10) Разнообразь переходы: не начинай разделы одной и той же связкой и не повторяй уже "
    "сказанные обороты. Внутри лекции не здоровайся и не представляйся повторно.\n"
    "Выведи ТОЛЬКО готовый текст для озвучки: без markdown, без заголовков, без комментариев."
)

_OPENING_NOTE = (
    "\nЭто ПЕРВЫЙ фрагмент лекции. Начни с короткого приветствия от первого лица: "
    "поздоровайся, представься («С вами Фреди»), назови тему сегодняшней лекции своими словами "
    "и одной фразой скажи, чем она будет полезна. Затем плавно переходи к материалу."
)
_CLOSING_NOTE = (
    "\nЭто ПОСЛЕДНИЙ фрагмент лекции. Заверши тёплым коротким прощанием от первого лица: "
    "поблагодари за внимание, скажи, что продолжение курса ждёт в лектории, и что обсудить "
    "услышанное можно со мной — с Фреди — в приложении. Без рекламного тона, по-человечески."
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
            "model": "deepseek-chat",
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
            provider="deepseek", model="deepseek-chat",
            input_tokens=tk[0], output_tokens=tk[1],
            feature="tts.lecture_rewrite",
        ))
    except Exception:
        pass
    return out


def _plain_speech(text: str) -> str:
    """Фолбэк без LLM: заголовки — в связки с паузами, числа — словами."""
    text = re.sub(r"\n?§ ([^\n]+)\n?", r". … \1 … ", text)
    text = text.replace("[СХЕМА: ", "На странице лекции есть схема: ").replace("]", "")
    try:
        from services.voice_service import normalize_numbers
        text = normalize_numbers(text)
    except Exception as e:
        logger.warning(f"blog-tts: normalize_numbers unavailable: {e}")
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
        try:
            from services.voice_service import normalize_numbers
            speech = normalize_numbers(speech)
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


def _strip_inline_tags(text: str) -> str:
    """Убирает управляющие Fish-метки из текста. Обязательно перед синтезом
    Яндексом (он бы прочитал их вслух) и на Fish-ветке, когда теги выключены."""
    return re.sub(r"\s{2,}", " ", _INLINE_TAG_RE.sub(" ", text)).strip()


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


async def _synth_all(client: httpx.AsyncClient, speech: str, slug: str):
    """Озвучивает весь текст ОДНИМ голосом: сначала пробуем Fish (голос Фреди),
    и если он споткнулся на любом куске — переозвучиваем всё Яндексом целиком,
    чтобы голос не менялся посреди лекции. Возвращает (mp3, provider)."""
    if BLOG_TTS_PROVIDER == "fish":
        from services.fish_audio_service import synthesize_fish_audio, fish_configured
        if not fish_configured():
            # Нет ключа/голоса Фреди — не сыпем страшными варнингами на каждый
            # кусок, честно уходим в Яндекс и пишем это один раз.
            logger.warning(f"blog-tts {slug}: Fish не настроен (нет FISH_AUDIO_API_KEY/VOICE_ID), озвучиваю Яндексом")
        else:
            try:
                parts = []
                for ch in _chunks(speech, FISH_CHUNK_LIMIT):
                    # Метки оставляем только если они включены (S2/S2.1); иначе
                    # вырезаем, чтобы Fish случайно не прочитал их вслух.
                    ch_fish = ch if BLOG_TTS_FISH_TAGS else _strip_inline_tags(ch)
                    # Один повтор на кусок: раньше единичный таймаут Fish
                    # ронял ВСЮ лекцию в Яндекс-голос. Повтор гасит случайные сбои.
                    audio = None
                    for attempt in range(2):
                        audio = await synthesize_fish_audio(ch_fish, timeout=FISH_TIMEOUT)
                        if audio:
                            break
                        if attempt == 0:
                            logger.info(f"blog-tts {slug}: пустой ответ Fish, повтор куска через 2с")
                            await asyncio.sleep(2)
                    if not audio:
                        raise RuntimeError("fish returned empty audio")
                    parts.append(audio)
                return b"".join(parts), "fish"
            except Exception as e:
                logger.warning(f"blog-tts {slug}: fish failed ({e}), re-voicing whole article via yandex")

    parts = [await _synth_yandex(client, ch) for ch in _chunks(speech, CHUNK_LIMIT)]
    return b"".join(parts), "yandex"


# ===== Кэш: mp3 + мета о том, чем и как он озвучен =====

def _meta_path(slug: str) -> str:
    return os.path.join(TTS_DIR, f"{slug}.meta.json")


def _read_meta(slug: str) -> dict:
    try:
        with open(_meta_path(slug), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _cache_ok(slug: str) -> bool:
    """Файл есть и озвучен текущим конвейером. Деградированный (Яндекс вместо
    Фреди) файл считается годным DEGRADED_RETRY_SECONDS, потом пробуем заново."""
    path = os.path.join(TTS_DIR, f"{slug}.mp3")
    if not (os.path.exists(path) and os.path.getsize(path) > 1000):
        return False
    meta = _read_meta(slug)
    if meta.get("v") != TTS_CACHE_VERSION or meta.get("wanted") != BLOG_TTS_PROVIDER:
        return False
    if meta.get("provider") != meta.get("wanted"):
        return time.time() - meta.get("ts", 0) < DEGRADED_RETRY_SECONDS
    return True


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
        audio, used = await _synth_all(client, speech, slug)

    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(audio)
    os.replace(tmp, path)
    try:
        with open(_meta_path(slug), "w", encoding="utf-8") as mf:
            json.dump({
                "v": TTS_CACHE_VERSION, "provider": used, "wanted": BLOG_TTS_PROVIDER,
                "ts": time.time(), "chars": len(speech),
            }, mf)
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
                 "skipped": 0, "errors": [], "started": 0, "finished": 0}
_LEKCIYA_RE = re.compile(r"/blog/(lekciya-[a-z0-9][a-z0-9-]{2,120})\.html")


async def _discover_lecture_slugs() -> list:
    """Собирает слаги всех лекций Лектория из sitemap сайта (lekciya-*)."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{SITE_BASE}/sitemap.xml")
        r.raise_for_status()
        slugs = _LEKCIYA_RE.findall(r.text)
    # уникализируем, сохраняя порядок
    seen, out = set(), []
    for s in slugs:
        if s not in seen and SLUG_RE.match(s):
            seen.add(s)
            out.append(s)
    return out


async def _pregenerate_run(slugs: list, force: bool = False):
    """Последовательно озвучивает список слагов, пропуская уже готовые.
    Последовательно — чтобы не разгонять расход Fish и нагрузку на LLM.
    force=True — переозвучить, даже если mp3 уже есть (кнопка «переозвучить»
    у отдельной лекции): сбрасываем мету, чтобы _cache_ok перестал считать
    файл годным, и генерируем заново."""
    _pregen.update(running=True, total=len(slugs), done=0, generated=0,
                   skipped=0, errors=[], started=time.time(), finished=0)
    try:
        for slug in slugs:
            try:
                if _cache_ok(slug) and not force:
                    _pregen["skipped"] += 1
                else:
                    lock = _locks.setdefault(slug, asyncio.Lock())
                    async with lock:
                        if force:
                            try:
                                os.remove(_meta_path(slug))
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


def register_blog_tts_routes(app, limiter):

    @app.get("/api/tts/blog/{slug}/status")
    @limiter.limit("60/minute")
    async def blog_tts_status(request: Request, slug: str):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"enabled": False}, status_code=400)
        if not YANDEX_API_KEY:
            return {"enabled": False}
        # v меняется при переозвучке: фронт добавляет его к URL,
        # чтобы браузер не играл вечно закэшированный старый голос
        meta = _read_meta(slug)
        try:
            from services.fish_audio_service import fish_configured
            _fish = fish_configured()
        except Exception:
            _fish = False
        # voice — каким голосом реально озвучен кэш: 'fish' (Фреди) или 'yandex'
        # (запасной). degraded=True, если хотели Фреди, а вышел Яндекс.
        return {
            "enabled": True, "ready": _cache_ok(slug),
            "url": f"/api/tts/blog/{slug}.mp3",
            "v": int(meta.get("ts", 0)),
            "voice": meta.get("provider"),
            "degraded": bool(meta) and meta.get("provider") not in (None, meta.get("wanted")),
            "fish": _fish,
            "generating": slug in _gen_tasks,
            "error": _gen_errors.get(slug),
        }

    @app.get("/api/tts/blog/{slug}.mp3")
    @limiter.limit("20/minute")
    async def blog_tts_audio(request: Request, slug: str):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"error": "bad slug"}, status_code=400)
        if not YANDEX_API_KEY:
            return JSONResponse({"error": "tts disabled"}, status_code=503)

        path = os.path.join(TTS_DIR, f"{slug}.mp3")
        if not _cache_ok(slug):
            # Генерация лекции (рерайт + синтез) занимает минуты — держать
            # соединение столько нельзя. Запускаем фоном и отвечаем 202,
            # фронт поллит /status и приходит за файлом, когда ready.
            if _gen_errors.get(slug) and slug not in _gen_tasks:
                err = _gen_errors.pop(slug)
                code = 404 if "article" in err else 502
                return JSONResponse({"error": err}, status_code=code)

            async def _run():
                lock = _locks.setdefault(slug, asyncio.Lock())
                try:
                    async with lock:
                        if not _cache_ok(slug):
                            await _generate(slug)
                    _gen_errors.pop(slug, None)
                except FileNotFoundError:
                    _gen_errors[slug] = "article not found"
                except Exception as e:
                    logger.error(f"blog-tts {slug} failed: {e}")
                    _gen_errors[slug] = "generation failed"
                finally:
                    _gen_tasks.pop(slug, None)

            if slug not in _gen_tasks:
                _gen_errors.pop(slug, None)
                _gen_tasks[slug] = asyncio.create_task(_run())
            return JSONResponse({"status": "generating"}, status_code=202)

        return FileResponse(
            path,
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

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
        if not YANDEX_API_KEY:
            return JSONResponse({"error": "tts disabled"}, status_code=503)
        if _pregen["running"]:
            return JSONResponse({"status": "already_running", **_pregen}, status_code=409)

        try:
            payload = await request.json()
        except Exception:
            payload = {}
        slugs = payload.get("slugs") if isinstance(payload, dict) else None
        force = bool(payload.get("force")) if isinstance(payload, dict) else False
        if slugs:
            slugs = [s for s in slugs if isinstance(s, str) and SLUG_RE.match(s)]
        else:
            try:
                slugs = await _discover_lecture_slugs()
            except Exception as e:
                return JSONResponse({"error": "discover failed", "detail": str(e)[:200]},
                                    status_code=502)
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

        order = []
        try:
            order = await _discover_lecture_slugs()
        except Exception as e:
            logger.warning(f"blog-tts list: discover failed: {e}")
        seen = set(order)
        orphans = set()
        try:
            for fn in os.listdir(TTS_DIR):
                if fn.endswith(".mp3"):
                    s = fn[:-4]
                    if s not in seen and SLUG_RE.match(s):
                        seen.add(s)
                        orphans.add(s)
                        order.append(s)
        except FileNotFoundError:
            pass

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
                "voice": meta.get("provider"),
                "wanted": meta.get("wanted"),
                "degraded": bool(meta) and meta.get("provider") not in (None, meta.get("wanted")),
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

    logger.info("Blog TTS routes registered (voice=%s, enabled=%s)", BLOG_TTS_VOICE, bool(YANDEX_API_KEY))
