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

TTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tts_blog")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,120}$")
CHUNK_LIMIT = 4500          # лимит Yandex v1 — 5000 символов на запрос
FISH_CHUNK_LIMIT = 1400     # Fish генерирует медленно: длинный кусок не успевает
FISH_TIMEOUT = 120.0        # ...поэтому куски короче, а таймаут щедрее
MAX_ARTICLE_CHARS = 60000   # предохранитель от аномально длинных страниц

# Версия конвейера озвучки. Меняются голос/режиссёр/промт — поднимаем
# на единицу, и закэшированные mp3 переозвучиваются при следующем запросе.
TTS_CACHE_VERSION = 2
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
    "После ключевых мыслей и перед новым разделом ставь многоточие — это пауза для слушателя.\n"
    "6) Обращайся к слушателю на «вы», добавляй живые связки и риторические вопросы, где уместно, — "
    "но без воды и без сюсюканья. Тон: тёплый увлечённый лектор, который любит свой предмет.\n"
    "7) Вопросы для самопроверки оформи как финальное обращение: «А теперь — вопросы, "
    "над которыми стоит подумать…». Список литературы сократи до одной фразы-рекомендации.\n"
    "8) Пометки вида [СХЕМА: …] означают иллюстрацию на странице лекции: сошлись на неё "
    "естественно («если вы открыли лекцию на экране — взгляните на схему: …») и перескажи её суть "
    "словами, чтобы слушателю без экрана тоже было понятно.\n"
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


async def _deepseek_rewrite(client: httpx.AsyncClient, segment: str, position: str = "") -> str:
    system = _REWRITE_PROMPT
    if position == "first":
        system += _OPENING_NOTE
    elif position == "last":
        system += _CLOSING_NOTE
    elif position == "only":
        system += _OPENING_NOTE + _CLOSING_NOTE
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
                out.append(await _deepseek_rewrite(client, seg, pos))
        speech = "\n\n".join(x for x in out if x)
        if len(speech) < len(text) * 0.4:
            raise ValueError("rewrite suspiciously short")
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


async def _synth_yandex(client: httpx.AsyncClient, text: str) -> bytes:
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
        try:
            from services.fish_audio_service import synthesize_fish_audio
            parts = []
            for ch in _chunks(speech, FISH_CHUNK_LIMIT):
                audio = await synthesize_fish_audio(ch, timeout=FISH_TIMEOUT)
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
        return {
            "enabled": True, "ready": _cache_ok(slug),
            "url": f"/api/tts/blog/{slug}.mp3",
            "v": int(_read_meta(slug).get("ts", 0)),
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

    logger.info("Blog TTS routes registered (voice=%s, enabled=%s)", BLOG_TTS_VOICE, bool(YANDEX_API_KEY))
