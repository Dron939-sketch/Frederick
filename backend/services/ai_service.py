#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сервис для работы с DeepSeek API
ВЕРСИЯ 3.4 — поддержка кастомного system_prompt для многоавторской архитектуры
"""

import time
import aiohttp
import asyncio
import json
import logging
import os
import re
import random
from typing import Optional, Dict, Any, List, AsyncGenerator

logger = logging.getLogger(__name__)

# Модель DeepSeek. API убрал алиас "deepseek-chat" (теперь только v4-*),
# поэтому имя вынесено в env: DEEPSEEK_MODEL (по умолчанию deepseek-v4-pro;
# можно переключить на deepseek-v4-flash для дешёвых/быстрых вызовов).
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-pro")

# Быстрая модель для входного чата. Рассуждающая модель думает перед
# ответом — на разборе и тесте это оправдано, а на реплике в четыре
# предложения обходится в 8-20 секунд молчания и упирается в лимит
# токенов (замерено: finish=length в шести случаях из восьми, медиана
# первого слова 14,4 с). Остальные вызовы остаются на DEEPSEEK_MODEL.
#
# Имя вынесено в env, чтобы менять и откатывать без деплоя. Если модели
# с таким именем не существует, вызов автоматически повторится на
# DEEPSEEK_MODEL — чат не сломается, в логе будет DEEPSEEK_FALLBACK.
DEEPSEEK_FAST_MODEL = os.environ.get("DEEPSEEK_FAST_MODEL", "deepseek-v4-flash")

# Честная аварийная фраза. Звучит, когда модель не вернула ответ — чаще
# всего это недоступность api.deepseek.com (наблюдалось: Amvera теряет
# маршрут к их CDN, «No route to host»). Раньше тут были бодрые «Уточни,
# на чём конкретно зацепило?» — человек уточнял и получал ту же фразу по
# кругу, это выглядело как издевательство и прямо так и было слышно в
# жалобах. Правда работает лучше: сбой назван сбоем, у человека есть
# понятное действие.
# Почему Фреди ответил заглушкой. Причина отказа DeepSeek жила только в
# логах Amvera: со стороны видно «бот отвечает одинаково», а балансом это,
# просроченным ключом или таймаутом — не отличить, пока не полезешь в лог.
# Так уже было с Fish: там причину вынесли в статус озвучки (fish_error), и
# разбор перестал требовать доступа к логам. Здесь то же самое.
LAST_AI_FAIL: dict = {"reason": "", "detail": "", "ts": 0, "count": 0}


def _note_ai_fail(reason: str, detail: str = ""):
    LAST_AI_FAIL["reason"] = reason
    LAST_AI_FAIL["detail"] = (detail or "")[:200]
    LAST_AI_FAIL["ts"] = time.time()
    LAST_AI_FAIL["count"] = LAST_AI_FAIL.get("count", 0) + 1


TECH_FAIL_REPLY = (
    "У меня технический сбой, ответить по делу сейчас не получается. "
    "Это не из-за тебя. Подожди пару минут и спроси ещё раз."
)

# Вторая и третья заглушка подряд — другими словами.
#
# 08.09 человек с 23:20 до 23:29 получил одну и ту же фразу четыре раза,
# включая голосовую попытку, и в конце спросил «почему ты не отвечаешь».
# Слово в слово повторённый отказ читается как издевательство: человек не
# понимает, слышат ли его вообще. Признать, что сбой длится, — честнее и
# дешевле любой другой правки.
TECH_FAIL_AGAIN = (
    "Всё ещё не отвечаю по делу — сбой не у тебя, а у меня, и он затянулся. "
    "Твой вопрос я не потерял. Попробуй через пару минут."
)
TECH_FAIL_LONG = (
    "Связь с моей головой до сих пор рвётся. Извини — это редкость, но "
    "сегодня попало на тебя. Напиши позже, я отвечу на то же самое."
)
_TECH_FAILS = (TECH_FAIL_REPLY, TECH_FAIL_AGAIN, TECH_FAIL_LONG)

# Сколько заглушек подряд получил человек. Сбрасывается настоящим ответом.
_FAIL_STREAK: dict = {}
_FAIL_STREAK_TTL = 30 * 60


def tech_fail_reply(user_id=None) -> str:
    """Заглушка с учётом того, сколько их подряд уже пришло этому человеку."""
    if user_id is None:
        return TECH_FAIL_REPLY
    now = time.time()
    n, ts = _FAIL_STREAK.get(user_id, (0, 0))
    if now - ts > _FAIL_STREAK_TTL:
        n = 0
    n += 1
    _FAIL_STREAK[user_id] = (n, now)
    if len(_FAIL_STREAK) > 5000:
        for k, (_, t) in list(_FAIL_STREAK.items()):
            if now - t > _FAIL_STREAK_TTL:
                _FAIL_STREAK.pop(k, None)
    return _TECH_FAILS[min(n, len(_TECH_FAILS)) - 1]


def note_ai_ok(user_id=None):
    """Настоящий ответ дошёл — серия отказов кончилась."""
    if user_id is not None:
        _FAIL_STREAK.pop(user_id, None)


def is_tech_fail(text) -> bool:
    """Любая из заглушек, а не только первая.

    Вызывающий код по этому признаку решает, сохранять ли реплику в
    историю и списывать ли минуты. С появлением второй и третьей
    формулировки сравнение с одной строкой перестало быть верным.
    """
    t = (text or "").strip()
    return any(t == f.strip() for f in _TECH_FAILS)


# Запасная «мысль психолога» — вынесена наружу, чтобы её узнавали.
# 17.09.2026 оказалось, что она сохранялась в fredi_psychologist_thoughts
# как обычный результат: все четыре места вызова писали в базу всё, что
# вернул генератор. А чтение устроено «есть запись — значит готово», и
# перегенерации не происходило никогда. Оба человека, прошедшие тест в
# тот день, остались с этим текстом навсегда — он ушёл им на экран, в
# письмо и в PDF под заголовком «Взгляд психолога».
#
# Признак заглушки нужен ровно за тем же, зачем is_tech_fail для реплик:
# чтобы вызывающий код знал, что сохранять это нельзя.
THOUGHT_FALLBACK = (
    "Мысль по твоему тесту сейчас не собралась — связь с моделью "
    "подвела. Нажми «Новая мысль», и я соберу её заново.\n\n"
    "А пока — общее наблюдение, не про тебя лично, а про многих, "
    "кто сюда приходит. Люди часто ставят интересы других выше "
    "своих и называют это заботой. Забота и правда так выглядит — "
    "до того момента, когда своё перестаёт помещаться в день "
    "совсем. Тогда это уже не забота, а способ не оставаться с "
    "собой наедине.\n\n"
    "Вопрос, с которым стоит посидеть: где проходит твоя граница "
    "между «помочь» и «исчезнуть»? И что случится, если один раз "
    "за неделю ты её не перейдёшь?"
)

# Опознавательная фраза. Сравнения с целой строкой мало: к моменту
# проверки текст мог пройти через format_psychologist_text, который
# приписывает спереди имя и снижает регистр первой буквы, — и равенство
# уже не сработает.
_THOUGHT_FALLBACK_MARK = "связь с моделью подвела"


def is_thought_fallback(text) -> bool:
    """Это запасная мысль, а не разбор по тесту. Сохранять её нельзя."""
    t = (text or "").strip()
    if not t:
        return False
    return t == THOUGHT_FALLBACK.strip() or _THOUGHT_FALLBACK_MARK in t.lower()


# Заголовки блоков разбора: по ним видно, дошёл ли ответ до конца.
_PROFILE_HEADINGS = (
    "ЭТО ПРО ТЕБЯ, ЕСЛИ",
    "ЧТО У ТЕБЯ СИЛЬНОГО",
    "ЧЕМ ЭТО ОБХОДИТСЯ",
    "ГЛАВНЫЙ УЗЕЛ",
    "ПЕРВЫЙ ШАГ СЕГОДНЯ",
    "О ЧЁМ СПРОСИТЬ МЕНЯ",
)


def profile_looks_complete(text) -> bool:
    """Разбор дошёл до конца, а не оборвался на первом заголовке.

    17.09.2026 у человека, прошедшего тест в 16:51, в базе лежал
    «AI-разбор» из двадцати знаков: «🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ» — один
    заголовок и ничего под ним. Модель оборвала ответ, строка оказалась
    непустой, вызывающий код сохранил её в ai_generated_profile, и
    дальше её читали и экран, и рекомендации, и PDF. Перегенерации не
    было и быть не могло: непустое поле означает «уже готово».

    Ровно эту ошибку убрали 14.09.2026 для заглушки — но проверка была
    на «текст есть», а не на «текст целый», и оборванный настоящий ответ
    прошёл сквозь неё.

    Требуем четыре заголовка из шести и разумный объём: промпт просит
    350–500 слов, так что настоящий разбор всегда за тысячу знаков.
    Четыре, а не шесть, — чтобы не выбрасывать почти целый разбор,
    если модель переименовала последний блок.
    """
    t = (text or "").strip()
    if len(t) < 1000:
        return False
    return sum(1 for h in _PROFILE_HEADINGS if h in t) >= 4


# Режим размышления. Обе модели DeepSeek по умолчанию думают перед
# ответом — и flash тоже, вопреки ожиданию. Именно это, а не выбор
# модели, давало 8-29 секунд молчания и finish=length в шести случаях
# из восьми: бюджет токенов уходил в невидимую часть.
#
# Формат — как у Anthropic: {"thinking": {"type": "enabled"|"disabled"}}.
#
# Здесь раньше стояло: «для разбора, теста и толкования оно остаётся
# включённым». 17.09.2026 это опровергнуто живыми данными, и опровержение
# оставлено в тексте, чтобы решение не завели обратно.
#
# Двое прошли тест в 16:39 и 16:51. Оба получили вместо «мысли психолога»
# заглушку «связь с моделью подвела», а у второго весь AI-разбор свёлся к
# двадцати знакам: «🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ» — один заголовок и пустота.
# При этом у первого разбор в ту же минуту собрался целиком, на 2500
# знаков. Значит модель была доступна, оплачена и отвечала: дело не в
# сбое сети.
#
# Разница между вызовами — только бюджет. Разбор просит 3500 токенов,
# мысль просила 1400. Невидимые рассуждения съедали бюджет раньше, чем
# начинался ответ: на 1400 не оставалось ничего (content пустой →
# заглушка), на 3500 оставалось на один заголовок. Ровно тот симптом,
# который описан ниже в _call_deepseek: «ответы по 16 и 65 знаков,
# оборванные посреди слова», finish=length при завышенном max_tokens.
#
# Поэтому размышление выключено у всех генераторов структурированного
# текста: разбор, мысль психолога, рекомендации, вопросы, цели, идеи.
# Все они получают короткий промпт с готовой схемой ответа — обдумывать
# там нечего, а бюджет рассуждения забирают целиком.
_THINKING_OFF = {"type": "disabled"}


def _apply_thinking(body: dict, thinking: Optional[bool]) -> dict:
    """thinking=False — выключить размышление. None — не трогать."""
    if thinking is False:
        body["thinking"] = _THINKING_OFF
    return body



async def call_deepseek(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> Optional[str]:
    service = AIService()
    return await service._simple_call(prompt, max_tokens, temperature)


async def call_deepseek_streaming(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> AsyncGenerator[str, None]:
    service = AIService()
    async for chunk in service._simple_call_streaming(prompt, max_tokens, temperature):
        if chunk and chunk.strip():
            yield chunk


class AIService:
    """Сервис для работы с DeepSeek API"""

    _instance = None

    def __new__(cls, cache=None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, cache=None):
        if getattr(self, '_initialized', False):
            return
        self.api_key = os.environ.get('DEEPSEEK_API_KEY')
        self.cache = cache
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://api.deepseek.com/v1"
        # Причина последнего неудачного _simple_call. Раньше все отказы —
        # нет ключа, 400, 401, таймаут, пустой ответ — сваливались в
        # один None, и на фронте выглядели одинаковым «AI не вернул
        # ответ». Разобрать по такому сообщению, что случилось, нельзя.
        self.last_error = ""
        self._initialized = True

        self.russell_quotes = [
            "Три страсти, простые и непреодолимо сильные, управляли моей жизнью: жажда любви, поиск знания и невыносимое сострадание к страданиям человечества.",
            "Любую проблему, которая не может быть решена, можно сделать меньше, научившись жить с ней.",
            "Страх — вот источник того, что люди называют злом. Большая часть зла в мире происходит от страха.",
            "Я никогда не позволял школе мешать моему образованию.",
            "Вера в истину начинается с сомнения в том, во что верят другие.",
            "Самый продуктивный способ думать — задавать правильные вопросы."
        ]

        if self.api_key:
            logger.info("✅ AIService инициализирован (singleton)")
        else:
            logger.warning("⚠️ DEEPSEEK_API_KEY not set")

    async def _get_session(self) -> aiohttp.ClientSession:
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=120)
            )
        return self.session

    async def _simple_call(self, prompt: str, max_tokens: int = 500, temperature: float = 0.7,
                           thinking: Optional[bool] = None,
                           _retry_budget: bool = True) -> Optional[str]:
        self.last_error = ""
        if not self.api_key:
            self.last_error = "нет ключа DEEPSEEK_API_KEY"
            return None
        try:
            session = await self._get_session()
            request_body = {
                "model": DEEPSEEK_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            # Раньше этот путь размышление не выключал вообще: параметр
            # сюда просто не был проведён, хотя _call_deepseek его умеет.
            # Отсюда и брались пустые ответы у модулей, которые ходят
            # через /api/ai/generate.
            _apply_thinking(request_body, thinking)
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=request_body,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']

                    # finish_reason и usage — единственный способ отличить
                    # «модель закончила мысль» от «бюджет токенов кончился
                    # и текст обрубило на полуслове». Второе наблюдалось в
                    # проде: ответы по 16 и 65 знаков, оборванные посреди
                    # слова. Если reason='length' при завышенном max_tokens,
                    # значит бюджет съедают невидимые рассуждения модели.
                    _fin = (data['choices'][0].get('finish_reason') or '?')
                    _u = data.get('usage') or {}
                    logger.info(
                        "🔴 DEEPSEEK_CALL finish=%s знаков=%d токены: промпт=%s "
                        "ответ=%s кэш(попало/мимо)=%s/%s"
                        % (_fin, len(result or ''), _u.get('prompt_tokens', '?'),
                           _u.get('completion_tokens', '?'),
                           _u.get('prompt_cache_hit_tokens', '?'),
                           _u.get('prompt_cache_miss_tokens', '?'))
                    )
                    if _fin == 'length':
                        logger.warning(
                            "✂️ Ответ обрублен по лимиту токенов: max_tokens=%s, "
                            "видимого текста %d знаков"
                            % (request_body.get('max_tokens'), len(result or ''))
                        )
                    
                    # Только нормализация пробелов — НЕ склеиваем слова!
                    result = re.sub(r'\s+', ' ', result).strip()

                    # Пустой видимый ответ при finish_reason='length' —
                    # это модель с рассуждениями съела весь бюджет токенов
                    # на невидимую часть. Прежний ретрай утраивал бюджет,
                    # но размышление не трогал — и в логах 02.09 видно, как
                    # модель съедала и 900 токенов, не выдав ни знака.
                    # Лечит не бюджет, а выключенное размышление: повтор
                    # идёт с thinking=False и умеренным запасом токенов.
                    if not result:
                        if _fin == 'length' and _retry_budget:
                            bigger = min(max(int(max_tokens) * 3, 300), 4000)
                            logger.warning(
                                "🔁 Пустой ответ при finish_reason=length, повтор с "
                                "thinking=off, max_tokens=%d (было %s, thinking=%s)"
                                % (bigger, max_tokens, thinking))
                            return await self._simple_call(prompt, bigger, temperature,
                                                           thinking=False,
                                                           _retry_budget=False)
                        self.last_error = ("модель вернула пустой ответ (finish_reason=%s, "
                                           "бюджет %s токенов)" % (_fin, max_tokens))
                        return None

                    logger.info(f"💬 Ответ ИИ после очистки: {len(result)} символов")
                    return result
                    
                elif response.status == 400:
                    self.last_error = "DeepSeek 400: запрос отклонён"
                    error_text = await response.text()
                    logger.error(f"❌ DeepSeek 400 error!")
                    logger.error(f"   Response body: {error_text}")
                    logger.error(f"   Request body (first 500 chars): {json.dumps(request_body, ensure_ascii=False)[:500]}")
                    return None
                    
                elif response.status == 401:
                    self.last_error = "DeepSeek 401: неверный ключ"
                    logger.error("❌ DeepSeek 401 error: Invalid API key")
                    return None
                    
                else:
                    self.last_error = "DeepSeek ответил %s" % response.status
                    logger.error(f"❌ DeepSeek error: {response.status}")
                    return None
        except asyncio.TimeoutError:
            self.last_error = "модель не ответила за 30 секунд"
            logger.error("❌ DeepSeek timeout")
            return None
        except Exception as e:
            self.last_error = "сбой запроса: %s" % str(e)[:120]
            logger.error(f"❌ DeepSeek error: {e}")
            return None

    async def _simple_call_streaming(self, prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield ""
            return
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {
            "model": DEEPSEEK_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers, json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    yield ""
                    return
                async for line in response.content:
                    if line:
                        line_str = line.decode('utf-8').strip()
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]
                            if data_str == '[DONE]':
                                break
                            try:
                                chunk = json.loads(data_str)
                                if 'choices' in chunk and chunk['choices']:
                                    content = chunk['choices'][0].get('delta', {}).get('content', '')
                                    if content:
                                        yield content
                                        await asyncio.sleep(0.005)
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield ""

    async def _call_deepseek(self, system_prompt: str, user_prompt: str,
                              max_tokens: int = 1000, temperature: float = 0.7,
                              model: Optional[str] = None,
                              thinking: Optional[bool] = None,
                              json_mode: bool = False,
                              _attempt: int = 0) -> Optional[str]:
        """model=None — обычная модель. Входной чат передаёт быструю.

        Если переданная модель неизвестна провайдеру (400), запрос
        повторяется на DEEPSEEK_MODEL: неверное имя в env не должно
        оставлять людей без ответа.

        json_mode=True включает у провайдера режим строгого JSON. Нужен
        там, где ответ разбирается json.loads: 14.09.2026 полный разбор
        падал с «Unterminated string» и «Expecting ',' delimiter» —
        модель отдавала JSON обычным текстом и обрывала его. Провайдер
        требует, чтобы слово JSON стояло в промпте; у вызывающих кода
        оно есть в описании формата.
        """
        if not self.api_key:
            return None
        _model = model or DEEPSEEK_MODEL
        try:
            session = await self._get_session()
            request_body = {
                "model": _model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            if json_mode:
                request_body["response_format"] = {"type": "json_object"}
            _apply_thinking(request_body, thinking)
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=request_body,
                timeout=aiohttp.ClientTimeout(total=120)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    
                    logger.info("=" * 80)
                    logger.info("🔴 RAW RESPONSE FROM DEEPSEEK:")
                    logger.info(f"📊 Длина ответа: {len(result)} символов")
                    logger.info(f"📝 Первые 500 символов ответа:")
                    logger.info(repr(result[:500]))
                    if len(result) > 500:
                        logger.info(f"... и еще {len(result) - 500} символов")
                    logger.info("=" * 80)
                    
                    # Нормализуем только множественные пробелы — НЕ трогаем переносы строк!
                    result = re.sub(r' {2,}', ' ', result)
                    result = re.sub(r'\n{3,}', '\n\n', result)
                    result = result.strip()
                    
                    logger.info(f"✅ DeepSeek ответ успешно получен (длина после очистки: {len(result)} символов)")
                    return result
                    
                elif response.status == 400:
                    error_text = await response.text()
                    logger.error(f"❌ DeepSeek 400 error! model={_model}")
                    logger.error(f"   Response body: {error_text}")
                    logger.error(f"   Request body (first 500 chars): {json.dumps(request_body, ensure_ascii=False)[:500]}")
                    if _model != DEEPSEEK_MODEL or thinking is not None:
                        logger.warning(
                            "↩️ DEEPSEEK_FALLBACK: отказ на model=%s thinking=%s, "
                            "повторяю на %s без параметра размышления"
                            % (_model, thinking, DEEPSEEK_MODEL))
                        return await self._call_deepseek(
                            system_prompt, user_prompt,
                            max_tokens=max_tokens, temperature=temperature,
                            model=DEEPSEEK_MODEL, thinking=None,
                            json_mode=json_mode)
                    return None
                    
                elif response.status == 401:
                    logger.error("❌ DeepSeek 401 error: Invalid API key")
                    logger.error(f"   API key (first 5 chars): {self.api_key[:5]}...")
                    _note_ai_fail("invalid_key", "DeepSeek 401: ключ не принят")
                    return None
                    
                elif response.status == 429:
                    logger.error("❌ DeepSeek 429 error: Rate limit exceeded")
                    _note_ai_fail("rate_limited", "DeepSeek 429: слишком часто")
                    return None
                    
                else:
                    logger.error(f"❌ DeepSeek error: {response.status}")
                    _body = ""
                    try:
                        _body = await response.text()
                        logger.error(f"   Response body: {_body[:500]}")
                    except Exception:
                        pass
                    # 402 у DeepSeek — «Insufficient Balance»: самая частая
                    # причина внезапной немоты, и по коду её видно сразу.
                    _note_ai_fail(
                        "no_balance" if response.status == 402 else f"http_{response.status}",
                        _body[:200] or f"DeepSeek ответил {response.status}")
                    # Кончившийся баланс и просроченный ключ повтором не
                    # лечатся; остальные коды — ещё один вызов.
                    return await self.spare_call(system_prompt, user_prompt,
                                                 max_tokens, temperature,
                                                 status=response.status)
                    
        except asyncio.TimeoutError:
            logger.error("❌ DeepSeek timeout (120 seconds)")
            _note_ai_fail("timeout", "DeepSeek молчал дольше 120 секунд")
            return await self._after_fail(system_prompt, user_prompt, max_tokens,
                                          temperature, model, thinking, _attempt,
                                          json_mode=json_mode)
        except aiohttp.ClientError as e:
            logger.error(f"❌ DeepSeek client error: {e}")
            _note_ai_fail("network", str(e))
            return await self._after_fail(system_prompt, user_prompt, max_tokens,
                                          temperature, model, thinking, _attempt,
                                          json_mode=json_mode)
        except Exception as e:
            logger.error(f"❌ DeepSeek unexpected error: {e}")
            logger.exception("Full traceback:")
            _note_ai_fail("error", str(e))
            return await self._after_fail(system_prompt, user_prompt, max_tokens,
                                          temperature, model, thinking, _attempt,
                                          json_mode=json_mode)

    async def spare_call(self, system_prompt: str, user_prompt: str,
                         max_tokens: int = 1000, temperature: float = 0.7,
                         status: Optional[int] = None) -> Optional[str]:
        """Дополнительный вызов DeepSeek, когда поток и его повтор не дали
        ни одной дельты.

        Запасной модели у проекта нет (решение владельца 13.09.2026: «нет
        API для запасной модели, поэтому не переключаем, а делаем
        дополнительный вызов»). До этого сюда был подключён Anthropic по
        ключу из env, ключа в env не было, и на проде фолбэк ни разу не
        сработал: 13.09 06:06 человек получил две заглушки подряд.

        Отличия от основного пути, чтобы не повторить тот же отказ:
        отдельное соединение вместо общего пула (застрявший пул — одна из
        причин «молчания»), без потока, без параметра размышления, обычная
        модель, пауза 2 с перед запросом, свой таймаут. Кончившийся баланс
        (402) и чужой ключ (401) ещё одним вызовом не лечатся — сразу None.
        """
        if not self.api_key or status in (401, 402):
            return None
        await asyncio.sleep(2)
        body = {
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt or ""},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        _apply_thinking(body, False)
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}",
                             "Content-Type": "application/json"},
                    json=body,
                    timeout=aiohttp.ClientTimeout(total=90),
                ) as r:
                    if r.status != 200:
                        detail = (await r.text())[:200]
                        logger.error("❌ spare call %s: %s", r.status, detail)
                        _note_ai_fail("spare_failed", "DeepSeek %s: %s" % (r.status, detail))
                        return None
                    data = await r.json()
            text = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
            text = text.strip()
            if text:
                logger.warning("↩️ SPARE_CALL: ответил дополнительный вызов, %d знаков", len(text))
            return text or None
        except Exception as e:
            logger.error("❌ spare call error: %s", e)
            _note_ai_fail("spare_failed", str(e))
            return None

    async def _after_fail(self, system_prompt, user_prompt, max_tokens,
                          temperature, model, thinking, attempt, json_mode=False):
        """Один повтор, потом дополнительный вызов без потока.

        До 08.09 отказ был окончательным с первой попытки: таймаут или
        оборванная сеть сразу превращались в заглушку. Полторы секунды
        паузы и второй заход снимают одиночный сбой; если и он не прошёл,
        отвечает дополнительный вызов (spare_call), а не заглушка.
        """
        if attempt == 0:
            await asyncio.sleep(1.5)
            logger.warning("↻ DeepSeek: повтор после отказа")
            out = await self._call_deepseek(system_prompt, user_prompt, max_tokens,
                                            temperature, model, thinking,
                                            json_mode=json_mode, _attempt=1)
            if out:
                return out
        return await self.spare_call(system_prompt, user_prompt,
                                     max_tokens, temperature)

    async def _call_deepseek_streaming(
        self, system_prompt: str, user_prompt: str,
        max_tokens: int = 1000, temperature: float = 0.7,
        model: Optional[str] = None, thinking: Optional[bool] = None,
        _retried: bool = False,
    ) -> AsyncGenerator[str, None]:
        """Стриминговый близнец _call_deepseek: тот же system+user сплит и
        те же параметры, но stream=True — отдаёт контент по дельтам, как
        только модель их генерирует.

        Нужен голосовому пайплайну: BasicMode собирает из дельт целые
        предложения и отдаёт их в TTS по мере готовности, не дожидаясь
        конца всей генерации. Промпт и содержание ответа не меняются —
        меняется только гранулярность выдачи. Если ключа нет или запрос
        падает, генератор просто завершится пустым, и вызывающий код
        откатится на блокирующий путь."""
        if not self.api_key:
            return
        _model = model or DEEPSEEK_MODEL
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {
            "model": _model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            # Последним чанком просим статистику по токенам. Без этого в
            # стриминге usage не приходит вовсе, а именно там лежит ответ на
            # главный вопрос: пересчитывается ли системный промпт заново на
            # каждом сообщении или попадает в кэш провайдера. Он у всех
            # пользователей побайтово одинаковый (12 994 знака), то есть
            # кэшироваться обязан.
            "stream_options": {"include_usage": True},
        }
        _apply_thinking(data, thinking)
        # Замер: сколько модель молчит до первого токена (TTFT) и сколько
        # потом занимает генерация. Греп «DEEPSEEK_LAT». Нужно, чтобы
        # отличать «тяжёлый промпт» от «провайдер тормозит»: снаружи оба
        # выглядят одинаково — человек просто ждёт.
        _t0 = time.time()
        _ttft = None
        _chars = 0
        _failed = False
        _usage = {}
        _finish = None
        _prompt_chars = len(system_prompt or "") + len(user_prompt or "")
        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers, json=data,
                # total считает весь поток целиком, а не паузу в нём: с
                # total=60 длинный ответ рубился на полуслове ровно на
                # шестидесятой секунде — модель исправно отдавала дельты,
                # но не успевала договорить. 15.09.2026 владелец получил
                # обрыв на «лишь бы не приближа»; в логах рядом стоит
                # «streaming timeout (60s) prompt_chars=20765».
                # Стоп-сигналом должна быть тишина, а не длина ответа:
                # sock_read рвёт поток, если дельт нет 45 секунд, total
                # остаётся крайней границей. Тот же разбор уже сделан для
                # голосового потока ниже — там total=180, sock_read=60.
                timeout=aiohttp.ClientTimeout(total=300, sock_read=45),
            ) as response:
                if response.status != 200:
                    body = ""
                    try:
                        body = (await response.text())[:300]
                    except Exception:
                        pass
                    # Раньше писали только код. Тело ответа тут важнее: на
                    # 400 в нём лежит причина (слишком длинный контекст,
                    # неизвестная модель), без которой отладка слепая.
                    logger.error("❌ DeepSeek streaming error: %s model=%s prompt_chars=%d body=%s"
                                 % (response.status, _model, _prompt_chars, body))
                    _note_ai_fail(
                        "no_balance" if response.status == 402
                        else "invalid_key" if response.status == 401
                        else "rate_limited" if response.status == 429
                        else f"http_{response.status}",
                        body or f"DeepSeek ответил {response.status} (model={_model})")
                    # Повтор «как раньше»: обычная модель и без параметра
                    # размышления. Неизвестное имя модели или неподдержанный
                    # ключ не должны оставлять человека без ответа.
                    if _model != DEEPSEEK_MODEL or thinking is not None:
                        logger.warning(
                            "↩️ DEEPSEEK_FALLBACK: отказ на model=%s thinking=%s, "
                            "повторяю на %s без параметра размышления"
                            % (_model, thinking, DEEPSEEK_MODEL))
                        async for _d in self._call_deepseek_streaming(
                                system_prompt, user_prompt, max_tokens=max_tokens,
                                temperature=temperature, model=DEEPSEEK_MODEL,
                                thinking=None):
                            _chars += len(_d)
                            yield _d
                        return
                    # Кончившийся баланс и чужой ключ повтором не лечатся;
                    # ограничение частоты и ошибки сервера — ещё один вызов
                    # после паузы.
                    _alt = await self.spare_call(
                        system_prompt, user_prompt, max_tokens, temperature,
                        status=response.status)
                    if _alt:
                        _chars += len(_alt)
                        yield _alt
                    return
                async for line in response.content:
                    if not line:
                        continue
                    line_str = line.decode('utf-8').strip()
                    if not line_str.startswith('data: '):
                        continue
                    data_str = line_str[6:]
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    # Статистика приходит отдельным чанком в самом конце,
                    # у него choices пустой — поэтому читаем её до проверки
                    # на choices, иначе потеряем.
                    if chunk.get('usage'):
                        _usage = chunk['usage']
                    if chunk.get('choices'):
                        _fr = chunk['choices'][0].get('finish_reason')
                        if _fr:
                            _finish = _fr
                        content = chunk['choices'][0].get('delta', {}).get('content', '')
                        if content:
                            if _ttft is None:
                                _ttft = time.time() - _t0
                            _chars += len(content)
                            yield content
        except asyncio.TimeoutError:
            logger.error("❌ DeepSeek streaming timeout: тишина 45с или поток дольше 300с, "
                         "prompt_chars=%d получено=%d знаков" % (_prompt_chars, _chars))
            _note_ai_fail("timeout", "DeepSeek замолчал на 45 секунд (получено %d знаков)" % _chars)
            _failed = True
        except Exception as e:
            logger.error(f"❌ DeepSeek streaming error: {e}")
            _note_ai_fail("error", str(e))
            _failed = True
        finally:
            _total = time.time() - _t0
            _hit = _usage.get("prompt_cache_hit_tokens")
            _miss = _usage.get("prompt_cache_miss_tokens")
            logger.info(
                "⏱️ DEEPSEEK_LAT ttft=%s генерация=%dms всего=%dms "
                "промпт=%d знаков (%s токенов, кэш: %s попало / %s мимо) "
                "ответ=%d знаков finish=%s model=%s"
                % ("%dms" % (_ttft * 1000) if _ttft is not None else "НЕТ ТОКЕНОВ",
                   (_total - (_ttft or 0)) * 1000, _total * 1000,
                   _prompt_chars, _usage.get("prompt_tokens", "?"),
                   _hit if _hit is not None else "?",
                   _miss if _miss is not None else "?",
                   _chars, _finish or '?', _model)
            )
            # Отдаём наружу, чтобы режим положил числа в событие аналитики:
            # логи приложения снаружи не читаются, события — читаются.
            self.last_stream_usage = {
                "ttft_ms": int((_ttft or 0) * 1000),
                "gen_ms": int((_total - (_ttft or 0)) * 1000),
                "prompt_tokens": _usage.get("prompt_tokens"),
                "cache_hit_tokens": _hit,
                "cache_miss_tokens": _miss,
                "finish": _finish,
            }

        # Ни одной дельты и был отказ — человек иначе получит заглушку.
        # Повторяем один раз, потом дополнительный вызов без потока: его
        # ответ приходит целиком, не по словам, но это несравнимо лучше,
        # чем «у меня технический сбой» четыре раза подряд.
        if _failed and _chars == 0:
            if not _retried:
                await asyncio.sleep(1.5)
                logger.warning("↻ DeepSeek streaming: повтор после отказа")
                async for _d in self._call_deepseek_streaming(
                        system_prompt, user_prompt, max_tokens=max_tokens,
                        temperature=temperature, model=model, thinking=thinking,
                        _retried=True):
                    _chars += len(_d)
                    yield _d
            if _chars == 0:
                _alt = await self.spare_call(system_prompt, user_prompt,
                                             max_tokens, temperature)
                if _alt:
                    yield _alt

    # ============================================
    # ГЕНЕРАЦИЯ ОТВЕТА — главный метод (обновлён)
    # ============================================

    async def generate_response(
        self,
        user_id: int,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist',
        system_prompt: Optional[str] = None,  # НОВЫЙ ПАРАМЕТР
        temperature: float = 0.7,
        max_tokens: int = 500,
        top_p: float = 0.9,
        frequency_penalty: float = 0.5,
        presence_penalty: float = 0.5
    ) -> str:
        """
        Генерация ответа с учётом истории диалога.
        
        Args:
            user_id: ID пользователя
            message: Сообщение пользователя
            context: Контекст (город, возраст и т.д.)
            profile: Профиль пользователя
            mode: Режим (basic, coach, psychologist, trainer)
            system_prompt: Прямая передача системного промпта (приоритет выше mode)
            temperature: Температура генерации
            max_tokens: Максимальное количество токенов
            top_p: Top-p sampling
            frequency_penalty: Штраф за повторения
            presence_penalty: Штраф за новые темы
        """
        cache_key = f"response:{user_id}:{hash(message)}:{mode}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return cached

        if not self.api_key:
            return self._get_fallback_response(mode)

        # Определяем системный промпт
        if system_prompt:
            final_system_prompt = system_prompt
            logger.info(f"🎭 Используется кастомный system_prompt (длина: {len(system_prompt)} символов)")
        else:
            final_system_prompt = self._get_system_prompt(mode, profile or {})
            logger.info(f"📌 Используется стандартный промпт для режима {mode}")

        # Вставляем блок «О собеседнике» прямо в system-prompt, чтобы
        # AI знал имя/пол/возраст и мог отвечать на «что ты обо мне знаешь».
        _user_block = self._build_user_facts_block(context, profile)
        if _user_block:
            final_system_prompt = f"{final_system_prompt}\n\n{_user_block}"

        # Строим сообщения для API
        messages = [{"role": "system", "content": final_system_prompt}]

        # Добавляем историю диалога (последние 10 сообщений = 5 обменов).
        # Увеличено с 6 на 10 — помогает AI видеть, что юзер уже повторял
        # вопрос, и не давать одинаковые ответы на переформулировки.
        history = (profile or {}).get('history', [])
        if history:
            for msg in history[-10:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')[:300]
                if role in ('user', 'assistant') and content:
                    messages.append({"role": role, "content": content})
            logger.info(f"📚 История: {len(history[-10:])} сообщений добавлено в контекст")

        # ФИКС off-by-one «отвечает на предыдущий вопрос»: в норме история
        # кончается ответом ассистента. Но при обрыве прошлого ответа (нет
        # сохранённого assistant) последний ход — user, и он склеивается с
        # текущим вопросом в две подряд user-реплики → модель отвечает на
        # старую. Срезаем висячие user-ходы из хвоста истории.
        while len(messages) > 1 and messages[-1]["role"] == "user":
            messages.pop()

        # Текущее сообщение
        user_prompt = self._get_user_prompt(message, context, profile, mode)
        messages.append({"role": "user", "content": user_prompt})

        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "top_p": top_p,
                    "frequency_penalty": frequency_penalty,
                    "presence_penalty": presence_penalty
                },
                # 30 с не хватало длинным ответам коуча/психолога (см.
                # generate_response_streaming, 12.09.2026); у basic — 120.
                timeout=aiohttp.ClientTimeout(total=120)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    result = self._clean_for_voice(result)
                    if self.cache:
                        await self.cache.set(cache_key, result, ttl=300)
                    return result
                else:
                    logger.error(f"DeepSeek API error: {response.status}")
                    return self._get_fallback_response(mode)
        except asyncio.TimeoutError:
            return "Извините, сервер временно перегружен. Попробуйте позже."
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            return self._get_fallback_response(mode)

    async def generate_response_streaming(
        self,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist',
        system_prompt: Optional[str] = None,  # НОВЫЙ ПАРАМЕТР
        temperature: float = 0.7,
        max_tokens: int = 500,
        top_p: float = 0.9,
        frequency_penalty: float = 0.5,
        presence_penalty: float = 0.5
    ) -> AsyncGenerator[str, None]:
        """
        Потоковая генерация с историей диалога.
        
        Args:
            message: Сообщение пользователя
            context: Контекст (город, возраст и т.д.)
            profile: Профиль пользователя
            mode: Режим (basic, coach, psychologist, trainer)
            system_prompt: Прямая передача системного промпта (приоритет выше mode)
            temperature: Температура генерации
            max_tokens: Максимальное количество токенов
            top_p: Top-p sampling
            frequency_penalty: Штраф за повторения
            presence_penalty: Штраф за новые темы
        """
        if not self.api_key:
            yield self._get_fallback_response(mode)
            return

        # Определяем системный промпт
        if system_prompt:
            final_system_prompt = system_prompt
            logger.info(f"🎭 Используется кастомный system_prompt (длина: {len(system_prompt)} символов)")
        else:
            final_system_prompt = self._get_system_prompt(mode, profile or {})
            logger.info(f"📌 Используется стандартный промпт для режима {mode}")

        # Вставляем блок «О собеседнике» прямо в system-prompt, чтобы
        # AI знал имя/пол/возраст и мог отвечать на «что ты обо мне знаешь».
        _user_block = self._build_user_facts_block(context, profile)
        if _user_block:
            final_system_prompt = f"{final_system_prompt}\n\n{_user_block}"

        # Строим сообщения для API
        messages = [{"role": "system", "content": final_system_prompt}]

        # Добавляем историю диалога (последние 10 сообщений = 5 обменов).
        # Увеличено с 6 на 10 — помогает AI видеть, что юзер уже повторял
        # вопрос, и не давать одинаковые ответы на переформулировки.
        history = (profile or {}).get('history', [])
        if history:
            for msg in history[-10:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')[:300]
                if role in ('user', 'assistant') and content:
                    messages.append({"role": role, "content": content})
            logger.info(f"📚 История: {len(history[-10:])} сообщений добавлено в контекст")

        # ФИКС off-by-one «отвечает на предыдущий вопрос»: в норме история
        # кончается ответом ассистента. Но при обрыве прошлого ответа (нет
        # сохранённого assistant) последний ход — user, и он склеивается с
        # текущим вопросом в две подряд user-реплики → модель отвечает на
        # старую. Срезаем висячие user-ходы из хвоста истории.
        while len(messages) > 1 and messages[-1]["role"] == "user":
            messages.pop()

        # Текущее сообщение
        user_prompt = self._get_user_prompt(message, context, profile, mode)
        messages.append({"role": "user", "content": user_prompt})

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "frequency_penalty": frequency_penalty,
            "presence_penalty": presence_penalty,
            "stream": True
        }
        # Размышление выключено (18.09.2026). Этот путь — коуч, психолог и
        # тренер — единственный, где _apply_thinking не вызывался вовсе:
        # basic ходит через _call_deepseek_streaming с thinking=False, все
        # генераторы разбора выключили его 17.09. А здесь модель по
        # умолчанию рассуждала в невидимой части и съедала max_tokens до
        # того, как начинался ответ: content приходил пустым при коде 200,
        # цикл ниже считал такой поток успешным и НЕ повторял, и коуч
        # отдавал заглушку «технический сбой». Выгрузка 11–17.09: 18
        # заглушек, 13 из них у коуча (max_tokens=1500, самый длинный
        # промпт), пять — на ПЕРВОМ ответе человеку, трое из пяти ушли.
        # DeepSeek при этом был жив: у других в ту же минуту всё работало.
        _apply_thinking(data, False)

        # Таймаут и повтор (12.09.2026). Здесь стоял общий таймаут 30 с на
        # весь поток, без повтора и без дополнительного вызова — в отличие от
        # _call_deepseek_streaming, которым отвечает basic. Ответ психолога
        # в 1100–1400 токенов в 30 с не укладывается: выгрузка за 7 дней —
        # 10 из 33 ответов психолога 11.09 обрезаны на полуслове, человек
        # написал «твои сообщения приходят не полностью»; у коуча 14 из 29
        # ответов — заглушка «технический сбой» (модель не успела отдать
        # первую дельту). Теперь: 180 с на поток и 60 с на паузу между
        # дельтами, один повтор при пустом ответе, затем дополнительный
        # вызов без потока (spare_call).
        _chars = 0
        _failed = False
        for _attempt in (1, 2):
            _failed = False
            try:
                session = await self._get_session()
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers, json=data,
                    timeout=aiohttp.ClientTimeout(total=180, sock_read=60)
                ) as response:
                    if response.status != 200:
                        _body = ""
                        try:
                            _body = (await response.text())[:200]
                        except Exception:
                            pass
                        logger.error(f"Streaming error: {response.status} {_body}")
                        _note_ai_fail("http_%s" % response.status, _body)
                        _failed = True
                    else:
                        async for line in response.content:
                            if line:
                                line_str = line.decode('utf-8').strip()
                                if line_str.startswith('data: '):
                                    data_str = line_str[6:]
                                    if data_str == '[DONE]':
                                        break
                                    try:
                                        chunk = json.loads(data_str)
                                        if 'choices' in chunk and chunk['choices']:
                                            content = chunk['choices'][0].get('delta', {}).get('content', '')
                                            if content:
                                                clean_content = self._clean_for_voice(content)
                                                if clean_content:
                                                    _chars += len(clean_content)
                                                    yield clean_content
                                    except json.JSONDecodeError:
                                        continue
            except asyncio.TimeoutError:
                logger.error("Streaming error: таймаут DeepSeek (mode=%s, получено %d симв.)" % (mode, _chars))
                _note_ai_fail("timeout", "streaming mode=%s chars=%d" % (mode, _chars))
                _failed = True
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                _note_ai_fail("error", str(e))
                _failed = True
            if _chars > 0:
                break
            # Ни одной дельты — повторяем, был ли формальный отказ или нет.
            # Раньше условие выхода было «_chars > 0 or not _failed»: поток
            # с кодом 200 и пустым content считался удачей, повтора не
            # было, и человек получал заглушку с первой попытки. Именно так
            # выглядит съеденный размышлением бюджет (см. _apply_thinking
            # выше) и любой «тихий» ответ провайдера.
            if _attempt == 1:
                await asyncio.sleep(1.5)
                logger.warning("↻ streaming (mode=%s): повтор — поток пуст (failed=%s)"
                               % (mode, _failed))

        if _chars == 0:
            # Обе попытки потока пусты — дополнительный вызов без потока,
            # ответ приходит целиком. Хуже живого потока, но лучше заглушки.
            _alt = None
            try:
                _alt = await self.spare_call(final_system_prompt, user_prompt,
                                             max_tokens, temperature)
            except Exception as e:
                logger.error(f"spare call error: {e}")
            if _alt:
                yield _alt
            else:
                yield self._get_fallback_response(mode)

    # ============================================
    # СИСТЕМНЫЕ ПРОМПТЫ (без изменений)
    # ============================================

    def _build_user_facts_block(self, context: Optional[Dict], profile: Optional[Dict]) -> str:
        """О СОБЕСЕДНИКЕ — имя/пол/возраст из профиля.
        Вставляется в system-prompt всех режимов, чтобы AI обращался
        по имени и мог ответить «что ты обо мне знаешь»."""
        ctx = context or {}
        prof = profile or {}
        name = (ctx.get("name") or prof.get("name") or "").strip()
        gender = (ctx.get("gender") or prof.get("gender") or "").strip().lower()
        age = ctx.get("age") or prof.get("age")
        parts = []
        if name:
            parts.append(f"Имя: {name}")
        if gender:
            g = "мужчина" if gender in ("male", "m", "мужской", "муж") else (
                "женщина" if gender in ("female", "f", "женский", "жен") else gender
            )
            parts.append(f"Пол: {g}")
        if age:
            parts.append(f"Возраст: {age}")
        if not parts:
            return ""
        return (
            "О СОБЕСЕДНИКЕ:\n" + "\n".join("- " + p for p in parts) + "\n"
            "Обращайся по имени естественно — примерно в каждом 2-3 ответе, без навязчивости. "
            "Если собеседник спросит «что ты обо мне знаешь» / «помнишь меня» / «мы общались» — "
            "ответь тепло: упомяни имя и 1–2 детали из истории ниже."
        )


    def _get_system_prompt(self, mode: str, profile: Dict) -> str:
        if mode == 'coach':
            return self._get_coach_prompt(profile)
        elif mode == 'psychologist':
            return self._get_psychologist_prompt(profile)
        elif mode == 'trainer':
            return self._get_trainer_prompt(profile)
        else:
            return self._get_basic_prompt()

    def _get_coach_prompt(self, profile: Dict) -> str:
        """Промпт для КОУЧА — образ Бертрана Рассела"""
        quote = random.choice(self.russell_quotes)
        return f"""ПРАВИЛО ФОРМАТИРОВАНИЯ (строго):
Пиши КАК В ЭТИХ ПРИМЕРАХ — с пробелами между словами:
ПРАВИЛЬНО: "Я замечаю, что ты начинаешь со счёта."
ПРАВИЛЬНО: "Расскажи, что происходит? Что тебя беспокоит?"
НЕПРАВИЛЬНО: "Язамечаю,чтотыначинаешьсосчёта."
НЕПРАВИЛЬНО: "Расскажи,чтопроисходит?Чтотебябеспокоит?"
Никаких ремарок в скобках. Никаких звёздочек.

Ты — Фреди. Твой стиль вдохновлён философией Бертрана Рассела: ясность мысли, скептицизм к готовым ответам, глубокая человечность.

✨ ЦИТАТА ДНЯ:
«{quote}»

🤝 ТВОЙ СТИЛЬ:
- Ты говоришь спокойно, вдумчиво, как философ, размышляющий вслух
- Ты задаёшь вопросы не для проверки, а из искреннего любопытства
- Ты помогаешь человеку найти свои ответы, а не даёшь готовые
- Ты мягко указываешь на противоречия, но без осуждения
- Ты ценишь ясность мысли и свободу от догм

💡 ПРИМЕРЫ ВОПРОСОВ:
- "Интересно, что заставляет тебя так думать?"
- "А если посмотреть на это с другой стороны?"
- "Что для тебя действительно важно — и почему?"
- "Какую роль играет страх в этом решении?"
- "Что было бы, если бы ты позволил себе усомниться в этом убеждении?"

❌ ЧЕГО НЕ ДЕЛАТЬ:
- Не давай готовых решений
- Не осуждай и не оценивай
- Не навязывай свою точку зрения
- Не игнорируй противоречия — исследуй их

✨ ПОМНИ: ты здесь, чтобы помочь человеку найти ясность через вопросы, а не через ответы.
Ты помнишь весь предыдущий разговор — опирайся на него в своих вопросах.

Теперь начни диалог. Будь мудрым собеседником, помогающим через вопросы."""

    def _get_psychologist_prompt(self, profile: Dict) -> str:
        """Промпт для ПСИХОЛОГА — глубинный анализ с конфайнтмент-моделью"""
        weakest_vector = profile.get('weakest_vector', 'не определен')
        weakest_level = profile.get('weakest_level', 3)
        return f"""ПРАВИЛО ФОРМАТИРОВАНИЯ (строго):
Пиши КАК В ЭТИХ ПРИМЕРАХ — с пробелами между словами:
ПРАВИЛЬНО: "Я замечаю, что ты начинаешь со счёта."
ПРАВИЛЬНО: "Расскажи, что происходит? Что тебя беспокоит?"
НЕПРАВИЛЬНО: "Язамечаю,чтотыначинаешьсосчёта."
НЕПРАВИЛЬНО: "Расскажи,чтопроисходит?Чтотебябеспокоит?"
Никаких ремарок в скобках. Никаких звёздочек.

Ты — Фреди, глубинный психолог. Ты видишь структуру личности и рекурсивные петли, которые держат человека в замкнутом круге.

📊 **О ЧЕЛОВЕКЕ**:
- Слабый вектор: {weakest_vector} (уровень {weakest_level}/6)

🤝 **ТВОЙ СТИЛЬ**:
- Ты говоришь спокойно, вдумчиво, с паузами
- Ты очень проницателен, но не давишь
- Ты называешь вещи своими именами, но бережно
- Ты помогаешь увидеть то, что было скрыто

💡 **ТЕХНИКИ**:
- Отражение глубинных паттернов: "Я замечаю, что..."
- Мягкое называние защит: "Похоже, ты используешь защиту..."
- Указание на петли самоподдержания: "Здесь есть интересный цикл..."
- Предложение точек разрыва: "Что, если попробовать иначе..."

❌ **ЧЕГО НЕ ДЕЛАТЬ**:
- Не дави и не критикуй
- Не интерпретируй агрессивно
- Не будь холодным или отстранённым

✨ **ПОМНИ**: ты видишь структуру личности. Говори с позиции понимания, но без осуждения.
Ты помнишь весь предыдущий разговор — замечай связи между тем что человек говорил раньше и сейчас.

Теперь начни диалог. Будь внимательным и проницательным собеседником."""

    def _get_trainer_prompt(self, profile: Dict) -> str:
        """Промпт для ТРЕНЕРА — образ Тони Робинсона (мотивирующий, энергичный)"""
        weakest_vector = profile.get('weakest_vector', 'не определен')
        weakest_level = profile.get('weakest_level', 3)
        return f"""ПРАВИЛО ФОРМАТИРОВАНИЯ (строго):
Пиши КАК В ЭТИХ ПРИМЕРАХ — с пробелами между словами:
ПРАВИЛЬНО: "Я замечаю, что ты начинаешь со счёта."
ПРАВИЛЬНО: "Расскажи, что происходит? Что тебя беспокоит?"
НЕПРАВИЛЬНО: "Язамечаю,чтотыначинаешьсосчёта."
НЕПРАВИЛЬНО: "Расскажи,чтопроисходит?Чтотебябеспокоит?"
Никаких ремарок в скобках. Никаких звёздочек.

Ты — Фреди, энергичный и вдохновляющий персональный тренер. Твоя миссия — помочь человеку раскрыть его потенциал через действие.

🌟 **О ЧЕЛОВЕКЕ**:
- Зона роста: {weakest_vector} (уровень {weakest_level}/6)

💪 **ТВОЙ СТИЛЬ**:
- Энергичный, вдохновляющий, заряжающий
- Говори с убеждением и верой в успех
- Используй фразы: "Давай!", "Ты сможешь!", "Я верю в тебя!"
- Конкретные шаги, чёткие планы

💡 **КАК ОБЩАТЬСЯ**:
- Начинай с позитивного заряда: "Эй, друг! Как настроение?"
- Задавай вопросы, которые зажигают: "Что для тебя было бы победой сегодня?"
- Дай конкретную задачу с верой в выполнение
- Завершай словами поддержки: "Ты справишься! Держу за тебя кулаки!"

❌ **ЧЕГО НЕ ДЕЛАТЬ**:
- Не дави и не критикуй — только вдохновляй
- Не будь холодным или безразличным
- Не используй жёсткие формулировки

🎯 **ПРИМЕРЫ ЗАДАЧ**:
- "Твоя задача на сегодня: сделать один маленький шаг к цели. Какой?"
- "Давай поставим дедлайн. Когда ты это сделаешь?"
- "Что для тебя было бы победой сегодня? Давай это сделаем!"

🔥 **ПОМНИ**: ты здесь, чтобы зажечь огонь внутри человека, дать ему энергию для действий и веру в себя.
Ты помнишь весь разговор — используй прошлые цели и победы человека для мотивации.

Теперь начни диалог. Будь заряжающим и вдохновляющим тренером!"""

    def _get_basic_prompt(self) -> str:
        """Промпт для БАЗОВОГО РЕЖИМА — дружелюбный помощник"""
        return """Ты — Фреди, внимательный друг и поддерживающий помощник.

ВАЖНО: Пиши ТОЛЬКО с пробелами между словами. НЕ склеивай слова.
ОБЯЗАТЕЛЬНО используй знаки препинания: точки, запятые, вопросительные знаки.

Характер:
- Ты внимательно слушаешь и слышишь человека
- Ты поддерживаешь, даёшь надежду и веру в себя
- Ты говоришь мягко, спокойно, бережно
- Ты помогаешь найти решения, а не даёшь готовые ответы

Правила ответа:
- Отвечай коротко (1-2 предложения), но содержательно
- Задавай открытые вопросы, помогающие человеку разобраться в себе
- Проявляй эмпатию, показывай, что ты слышишь
- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию

Тёплые обращения (используй иногда):
- друг мой
- дорогой друг
- ты знаешь
- послушай
- поделись

Ты помнишь весь предыдущий разговор — учитывай это в ответах.
Теперь ответь на вопрос пользователя тепло и поддерживающе."""

    # ============================================
    # ФОРМИРОВАНИЕ ПРОМПТА ПОЛЬЗОВАТЕЛЯ
    # ============================================

    def _get_user_prompt(self, message: str, context: Dict, profile: Dict, mode: str) -> str:
        """Формирование промпта — только текущее сообщение + контекст."""
        prompt = message

        if context and mode != 'basic':
            parts = []
            if context.get('city'):
                parts.append(f"город {context['city']}")
            if context.get('age'):
                parts.append(f"возраст {context['age']}")
            if parts:
                prompt += f"\n\nКонтекст: {', '.join(parts)}"

        if profile and mode != 'basic':
            profile_code = profile.get('profile_data', {}).get('display_name')
            if profile_code:
                prompt += f"\n\nПрофиль: {profile_code}"

        return prompt

    # ============================================
    # ГЕНЕРАЦИЯ ПРОФИЛЯ, МЫСЛЕЙ, ЦЕЛЕЙ
    # ============================================

    # Каталог для рекомендаций после теста. AI выбирает ТОЛЬКО из него
    # и возвращает id — ссылки собирает сервер, чтобы модель не могла
    # выдумать несуществующий адрес. «who» — подсказка модели, кому это.
    TEST_REC_CATALOG = {
        # Курсы Лектория
        'trevoga': ('course', 'Курс «Тревога»', '/blog/lektorij/trevoga/',
                    'постоянное беспокойство, катастрофы в голове, замирание под давлением'),
        'stress-menedzhment': ('course', 'Курс «Стресс-менеджмент»', '/blog/lektorij/stress-menedzhment/',
                    'выгорание, перегрузки, срывы под давлением'),
        'samoregulyaciya': ('course', 'Курс «Саморегуляция»', '/blog/lektorij/samoregulyaciya/',
                    'эмоции захлёстывают, вспышки гнева, трудно вернуться в покой'),
        'lichnye-granicy': ('course', 'Курс «Личные границы»', '/blog/lektorij/lichnye-granicy/',
                    'соглашается против воли, не умеет отказывать, внешне спокоен ценой себя'),
        'samoocenka': ('course', 'Курс «Самооценка»', '/blog/lektorij/samoocenka/',
                    'самоедство, зависимость от чужой оценки, «я недостаточно хорош»'),
        'kpt-samostoyatelno': ('course', 'Курс «КПТ самостоятельно»', '/blog/lektorij/kpt-samostoyatelno/',
                    'руминации, автоматические негативные мысли, хочет рабочий метод'),
        'stimulnyj-kontrol': ('course', 'Курс «Стимульный контроль для родителей»', '/blog/lektorij/stimulnyj-kontrol/',
                    'ребёнок не слушается, не останавливается после «нельзя», бросает при первой неудаче'),
        'prokrastinaciya-i-motivaciya': ('course', 'Курс «Прокрастинация и мотивация»', '/blog/lektorij/prokrastinaciya-i-motivaciya/',
                    'откладывает, не доводит до конца, мотивация рывками'),
        'dengi-i-psihologiya': ('course', 'Курс «Деньги и психология»', '/blog/lektorij/dengi-i-psihologiya/',
                    'низкий денежный вектор: «деньги как повезёт», страх считать'),
        'svoya-koleya': ('course', 'Курс «Своя колея»', '/blog/lektorij/svoya-koleya/',
                    'живёт чужими решениями и ожиданиями, нет своего курса'),
        'kriticheskoe-myshlenie': ('course', 'Курс «Критическое мышление»', '/blog/lektorij/kriticheskoe-myshlenie/',
                    'верит на слово, картина мира из чужих мнений, тянет к заговорам'),
        'myshlenie': ('course', 'Курс «Мышление и когнитивные искажения»', '/blog/lektorij/myshlenie/',
                    'хочет думать точнее, ловить свои ошибки мышления'),
        'prinyatie-reshenij': ('course', 'Курс «Принятие решений»', '/blog/lektorij/prinyatie-reshenij/',
                    'мечется между вариантами, откладывает выборы, потом жалеет'),
        'konflikty': ('course', 'Курс «Конфликты»', '/blog/lektorij/konflikty/',
                    'один и тот же круг ссор с одними и теми же людьми'),
        'emocionalnyj-intellekt': ('course', 'Курс «Эмоциональный интеллект»', '/blog/lektorij/emocionalnyj-intellekt/',
                    'плохо распознаёт свои и чужие чувства, сильная привязанность или отстранённость'),
        'peregovory': ('course', 'Курс «Переговоры»', '/blog/lektorij/peregovory/',
                    'гнётся под напором, уступает в спорах о деньгах и условиях'),
        'odinochestvo': ('course', 'Курс «Одиночество»', '/blog/lektorij/odinochestvo/',
                    'мало близких связей, тяжело сближаться'),
        # Игры-тренажёры Фреди (deep-link /fredi/?m=...)
        'perehod': ('game', 'Симулятор «Переход»', '/fredi/?m=perehod',
                    'месяц из десяти решений: увидеть, чьи решения на самом деле исполняешь'),
        'avtopilot': ('game', 'Тренажёр «Автопилот»', '/fredi/?m=avtopilot',
                    'поставить себе мыслительный навык на триггер: «хочу, а нет» с индексацией ресурсов, «не вышло — а как ещё»'),
        'parus': ('game', 'Тренажёр «Парус»', '/fredi/?m=parus',
                    'перегрузки: всё разом навалилось, не разобрать потоки'),
        'spiral': ('game', 'Симулятор дня «Спираль»', '/fredi/?m=spiral',
                    'упадок сил, апатия, день не собирается'),
        'mysl': ('game', 'Игра «Мысль под допросом»', '/fredi/?m=mysl',
                    'разбор тревожной мысли по КПТ на практике'),
        'skazhinet': ('game', 'Тренажёр «Скажи нет»', '/fredi/?m=skazhinet',
                    'тренировка отказа: границы в безопасной песочнице'),
        'chuvstva': ('game', 'Игра «Чувства»', '/fredi/?m=chuvstva',
                    'эмоциональный словарь: учиться называть, что чувствуешь'),
        'delo': ('game', 'Бизнес-симулятор «Своё дело»', '/fredi/?m=delo',
                    'денежное мышление в деле: решения, риск, счёт'),
        'kalibr': ('game', 'Игра «Калибровка»', '/fredi/?m=kalibr',
                    'проверка самоуверенности: насколько твоя уверенность совпадает с правотой'),
        'advokat': ('game', 'Игра «Адвокат дьявола»', '/fredi/?m=advokat',
                    'гибкость убеждений: защитить позицию, с которой не согласен'),
        'korka': ('game', 'Игра «Короли и капуста»', '/fredi/?m=korka',
                    'чтение людей и связи: нетворкинг без фальши'),
        # Живой формат
        'treningi': ('trening', 'Живые тренинги Андрея Мейстера', '/treningi/',
                    'когда нужен живой формат, группа и обратная связь от ведущего'),
    }

    # Что это за формат — человеку нужно понимать, куда он идёт и во что
    # это ему обойдётся, до того как нажмёт. Числа (сколько лекций в курсе)
    # сюда намеренно не вписаны: они разъезжаются с каталогом в первый же
    # день, для этого есть link_lektorij.py на стороне сайта.
    REC_FORMAT_VERSION = 2

    REC_FORMAT = {
        'course': 'Курс Лектория — бесплатно, без регистрации',
        'game': 'Тренажёр в приложении — 10–15 минут',
        'trening': 'Живой тренинг с ведущим, в группе',
    }

    def _rec_items(self, ids_with_reasons):
        items = []
        for rec_id, reason in ids_with_reasons:
            entry = self.TEST_REC_CATALOG.get(rec_id)
            if not entry:
                continue
            reason_text, what_text = reason if isinstance(reason, tuple) else (reason, '')
            items.append({'id': rec_id, 'type': entry[0], 'title': entry[1],
                          'url': entry[2], 'reason': reason_text,
                          'what': what_text,
                          'format': self.REC_FORMAT.get(entry[0], ''),
                          # Версия формата записи. Кэш рекомендаций в профиле
                          # вечный, и опознавать «старый вид» по наличию
                          # отдельного поля ненадёжно: поле может быть пустым
                          # законно (модель не прислала what), и тогда кэш
                          # пересобирался бы на каждом запросе. Номер растёт
                          # только когда формат меняем мы.
                          'v': self.REC_FORMAT_VERSION})
        return items

    def _get_recommendations_fallback(self, profile: Dict) -> List[Dict]:
        """Без AI: курс и игра по самому слабому вектору плюс «Переход»."""
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3.0
        weakest = min(scores, key=scores.get)
        # Пара (зачем, что даст) — то же, что просится у модели. Запасной
        # набор срабатывает чаще, чем кажется (нет ключа, сбой сети, модель
        # вернула мусор), и без второй половины человек 14.09.2026 видел на
        # проде «Зачем вам» без «Что даст» — половину обещанного.
        by_vector = {
            'СБ': [('trevoga',
                    ('Твой самый уязвимый вектор — поведение под давлением. Этот курс разбирает его по шагам.',
                     'Научишься замечать момент, когда соглашаешься из страха, и отвечать иначе.')),
                   ('mysl',
                    ('Тренажёр, где тревожная мысль разбирается по косточкам — прямо на твоих примерах.',
                     'Сможешь отделять факт от догадки в момент тревоги, а не через сутки.'))],
            'ТФ': [('dengi-i-psihologiya',
                    ('Денежный вектор у тебя самый слабый — курс про то, как мышление держит доход.',
                     'Поймёшь, какие свои решения о деньгах ты принимаешь на автомате и во что они обходятся.')),
                   ('delo',
                    ('Симулятор, где денежные решения можно тренировать без риска для кошелька.',
                     'Увидишь на своих ходах, где ты недооцениваешь риск, а где — наоборот, тормозишь зря.'))],
            'УБ': [('kriticheskoe-myshlenie',
                    ('Твой слабый вектор — картина мира. Курс учит проверять то, во что веришь.',
                     'Сможешь отличать довод от уверенного тона — в новостях, в спорах и у себя в голове.')),
                   ('kalibr',
                    ('Игра покажет, где твоя уверенность обгоняет твою правоту.',
                     'Узнаешь свою реальную точность и перестанешь ставить на «я точно знаю».'))],
            'ЧВ': [('konflikty',
                    ('Вектор отношений у тебя проседает — курс про повторяющиеся круги ссор.',
                     'Научишься выходить из ссоры до точки, после которой говорят лишнее.')),
                   ('chuvstva',
                    ('Тренажёр эмоционального словаря: называть чувства точнее — половина навыка.',
                     'Сможешь сказать, что именно чувствуешь, вместо «всё нормально» и «я просто устал».'))],
        }
        picks = list(by_vector.get(weakest, by_vector['СБ']))
        if not any(pid == 'perehod' for pid, _ in picks):
            picks.append(('perehod',
                          ('Месяц из десяти решений: увидишь, чьи решения ты на самом деле исполняешь.',
                           'Поймёшь, сколько в твоём месяце своих выборов, а сколько — чужих ожиданий.')))
        return self._rec_items(picks)

    async def generate_test_recommendations(self, user_id: int, profile: Dict) -> List[Dict]:
        """Три персональных шага после теста: курс, игра и третье по нужде.

        AI выбирает только id из каталога — ссылки и названия собирает
        сервер. Любой сбой генерации или разбора — rule-based fallback,
        человек без рекомендаций не остаётся.
        """
        if not self.api_key:
            return self._get_recommendations_fallback(profile)

        catalog_lines = '\n'.join(
            f'- {rid} [{entry[0]}] {entry[1]} — {entry[3]}'
            for rid, entry in self.TEST_REC_CATALOG.items())

        system_prompt = f"""Ты — психолог Фреди. По профилю пользователя выбери ровно 3 рекомендации из каталога: один курс [course], одну игру [game], третью — что нужнее (course/game/trening).

КАТАЛОГ (выбирать ТОЛЬКО отсюда, по id):
{catalog_lines}

Ответ — СТРОГО JSON-массив без пояснений:
[{{"id": "...", "reason": "...", "what": "..."}}, ...]

reason — 1-2 предложения на «ты»: почему именно ему, с опорой на его профиль. Назови, что в его результатах на это указывает. Без общих слов «это полезно каждому».
what — одно предложение: что он будет уметь или понимать после, конкретно. Не «станет лучше», а что именно изменится в его поведении."""

        behavioral_levels = profile.get('behavioral_levels', {})
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = behavioral_levels.get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3.0
        profile_data = profile.get('profile_data', {})
        user_prompt = f"""
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9
Профиль: {profile_data.get('display_name', 'не определен')}
СБ (под давлением): {scores.get('СБ', 3):.1f}/6  ТФ (деньги): {scores.get('ТФ', 3):.1f}/6
УБ (картина мира): {scores.get('УБ', 3):.1f}/6  ЧВ (отношения): {scores.get('ЧВ', 3):.1f}/6
Паттерны: {self._format_deep_patterns(profile.get('deep_patterns', {}))}
"""
        response = await self._call_deepseek(system_prompt, user_prompt,
                                             max_tokens=700, temperature=0.4,
                                             thinking=False)
        if response:
            try:
                m = re.search(r'\[.*\]', response, re.DOTALL)
                if m:
                    raw = json.loads(m.group())
                    if isinstance(raw, list):
                        pairs = [(str(r.get('id', '')),
                                  (str(r.get('reason', '')).strip(),
                                   str(r.get('what', '')).strip()))
                                 for r in raw if isinstance(r, dict)]
                        items = self._rec_items([p for p in pairs
                                                 if p[0] in self.TEST_REC_CATALOG and p[1][0]])
                        if len(items) >= 2:
                            return items[:3]
            except (json.JSONDecodeError, AttributeError, TypeError):
                pass
        return self._get_recommendations_fallback(profile)

    async def generate_ai_profile(self, user_id: int, profile: Dict) -> Optional[str]:
        """None вместо заглушки, если портрет не собрался.

        14.09.2026 владелец прошёл тест и получил под заголовком
        «AI-СГЕНЕРИРОВАННЫЙ ПРОФИЛЬ» общий текст про «высокий уровень
        адаптивности» и «устойчивость к стрессу» — человеку с тревожным
        типом привязанности, про которого этап 5 на том же экране писал
        «болезненно реагируешь на холодность». Заканчивался текст строкой
        «Ваш профиль: СБ-4_ТФ-4_УБ-4_ЧВ-4», хотя настоящий код был
        СБ-5_ТФ-6_УБ-6_ЧВ-6. Это была заглушка _get_profile_fallback.

        Хуже того, заглушка сохранялась в ai_generated_profile навсегда:
        оттуда её читал полный разбор и рекомендации, то есть один сбой
        сети отравлял всё, что человек увидит дальше. Оба вызывающих
        места сохраняют результат только при истинном значении — значит
        None здесь означает «попробуем в следующий раз», и это честнее
        вымышленного портрета.
        """
        if not self.api_key:
            return None

        # Схема разбора — из бота «Тестирование личности» (репозиторий
        # владельца): узнавание → цена проблемы → первый шаг → что дальше.
        # Она там уже работает, и владелец 16.09.2026 попросил тот же
        # порядок здесь, добавив похвалу перед ценой: «сначала похвалить за
        # сильные стороны, потом чутка напугать, чем обернутся слабые, и
        # только потом — как это исправить».
        #
        # Прежний портрет был пятью общими блоками («ключевая
        # характеристика», «сильные стороны», «зоны роста», «как это
        # сформировалось», «главная ловушка») и читался как гороскоп без
        # гороскопа: ни одной фразы, по которой человек узнал бы себя, и
        # ни одной причины что-то делать сегодня. Владелец про него:
        # «как будто не дожали — не напугали и не обрадовали».
        system_prompt = """Ты — психолог Фреди. Пишешь разбор человеку, который только что прошёл тест.

Он видит этот текст сразу после результатов и решает: узнал он себя или нет.
Если узнал — он останется говорить. Если нет — закроет вкладку и не вернётся.

ГЛАВНОЕ ПРАВИЛО: ни одной фразы, которая подошла бы всем. Каждый пункт
опирается на его ответы — те, что даны ниже. Не пересказывай ответы дословно,
но пиши так, чтобы он понял: это про него, а не про «людей такого типа».

СТРУКТУРА — ровно эти шесть блоков, в этом порядке:

🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ
5–6 пунктов через •. Узнавание, а не определение: конкретная ситуация, что
происходит в теле, внутреннее противоречие, парадокс («чем сильнее …, тем
меньше …»), и один пункт-вопрос к себе. Начинай каждый с глагола или с
ситуации, а не с «ты человек, который».

💪 ЧТО У ТЕБЯ СИЛЬНОГО
3 пункта через •. Честная похвала за то, что видно по ответам, с указанием,
где это работает на него. Не комплименты вообще — то, что он реально умеет.

⚠️ ЧЕМ ЭТО ОБХОДИТСЯ
Три цены, каждая с подзаголовком в формате «Цена 1. <короткое имя>» и
2–3 предложениями. Первая — что уже происходит сейчас; вторая — что будет
через год, если ничего не менять; третья — чего он из-за этого не получит,
хотя хочет. Пиши прямо и без смягчений, но без запугивания: никаких
болезней, диагнозов, «психика разрушится», «останешься один навсегда».
Это цена привычного хода, а не приговор.

🎯 ГЛАВНЫЙ УЗЕЛ
Один абзац: противоречие, из-за которого силы уходят впустую — обычно
сильная сторона, доведённая до автоматизма, и работает против него.
Заканчивай фразой вида «Ты ближе к тому, чего хочешь, чем думаешь. Не
хватает одного: …» и назови ровно одну нехватку — навык, а не черту.

🚀 ПЕРВЫЙ ШАГ СЕГОДНЯ
3 шага через •, каждый выполним сегодня вечером за 10–20 минут. Что именно
сделать, сказать или записать — по шагам. Никаких «осознай», «прими себя»,
«поработай с этим».

💬 О ЧЁМ СПРОСИТЬ МЕНЯ
2 вопроса от первого лица, которые ему стоит задать в разговоре (например
«Почему я замолкаю именно в тот момент, когда важно сказать?»). Это его
реплики, не твои.

ФОРМАТ. Заголовки — ЗАГЛАВНЫМИ, с эмодзи, каждый на отдельной строке,
между блоками пустая строка. Списки через •. Обращение на «ты», тёплое, без
менторства. Объём — 350–500 слов.

ЧЕГО НЕЛЬЗЯ.
• Не называй курсы, игры, лекции и книги — их подставит следующий блок
  экрана, и придуманное название человек потом не найдёт.
• Не противоречь разбору этапа 5: он на том же экране и уже назвал тип
  привязанности, базовую защиту и теневую сторону. Человеку с тревожной
  привязанностью нельзя писать «устойчив к стрессу».
• Не выводи код профиля — он уже стоит выше.
• Не ставь диагнозов и не предполагай болезней.
• Не обещай результат за срок («за две недели станешь»)."""

        profile_data = profile.get('profile_data', {})
        behavioral_levels = profile.get('behavioral_levels', {})
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = behavioral_levels.get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3.0

        # Собственные ответы человека — то, чего у портрета не было вовсе.
        # Без них модель знала только коды («СБ 4/6, тревожный тип») и
        # писала про людей такого типа, а не про него.
        answers_block = self._format_test_answers(profile.get('all_answers'))

        user_prompt = f"""
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9
Профиль: {profile_data.get('display_name', 'не определен')}
СБ: {scores.get('СБ', 3):.1f}/6  ТФ: {scores.get('ТФ', 3):.1f}/6
УБ: {scores.get('УБ', 3):.1f}/6  ЧВ: {scores.get('ЧВ', 3):.1f}/6
Паттерны: {self._format_deep_patterns(profile.get('deep_patterns', {}))}
{answers_block}
"""
        response = await self._call_deepseek(system_prompt, user_prompt,
                                             max_tokens=3500, thinking=False)
        if not profile_looks_complete(response):
            logger.warning(
                "AI-профиль не собрался целиком (%d знаков) — не сохраняем, "
                "соберём заново при следующем открытии",
                len(response or ""))
            return None
        return response

    @staticmethod
    def _format_test_answers(all_answers, limit: int = 18) -> str:
        """Ответы человека для промпта: вопрос → что он выбрал.

        Берём не все сорок, а последние по каждому этапу и самые
        показательные: в промпт целиком они не помещаются, а разбор
        строится на узнавании, не на статистике.
        """
        if not isinstance(all_answers, list) or not all_answers:
            return ""
        picked, seen = [], set()
        for a in all_answers:
            if not isinstance(a, dict):
                continue
            q = str(a.get("question") or "").strip()
            ans = str(a.get("answer") or "").strip()
            if not q or not ans or q in seen:
                continue
            seen.add(q)
            picked.append(f"— {q} → {ans}")
        if not picked:
            return ""
        step = max(1, len(picked) // limit)
        picked = picked[::step][:limit]
        return "\n\nЕГО СОБСТВЕННЫЕ ОТВЕТЫ (вопрос → что выбрал):\n" + "\n".join(picked)

    async def generate_psychologist_thought(self, user_id: int, profile: Dict) -> str:
        if not self.api_key:
            return self._get_thought_fallback(profile)

        # По одному предложению на раздел человек читал четыре секунды и
        # закрывал экран — владелец 17.09.2026: «нужно чуть подробнее
        # расписать». Просим 2–3 предложения на раздел и требуем говорить
        # про него, а не про психологию вообще: обобщение вроде «многие
        # люди склонны…» на этом экране бесполезно, человек пришёл за
        # собой. Потолок токенов поднят с 500 до 1400 — на прежнем текст
        # обрывался бы на четвёртом разделе.
        system_prompt = """Ты психолог, который час назад разобрал результаты
теста этого человека и теперь пишет свои мысли о нём. Не статью о
психологии — мысли о конкретном человеке.

Пять разделов, в каждом 2–3 предложения:

🔐 КЛЮЧЕВОЙ ЭЛЕМЕНТ — что в нём главное. Не диагноз, а механизм:
что он делает раз за разом и чего этим добивается.
🔄 ПЕТЛЯ — как это замыкается в круг. Опиши круг целиком: что запускает,
что он делает, чем это кончается и почему возвращает его в начало.
🚪 ТОЧКА ВХОДА — где этот круг тоньше всего рвётся. Конкретное место,
а не «работать над собой».
📊 ПРОГНОЗ — что будет через год, если ничего не менять, и что — если
тронуть точку входа. Без запугивания и без обещаний.
💡 РЕКОМЕНДАЦИИ — с чего начать на этой неделе. Одно-два действия,
которые можно сделать в ближайшие дни, а не «проработать травму».

Как писать:
- Обращайся на «ты», прямо к нему.
- Говори про него, а не про людей вообще. «Многие склонны…» — впустую.
- Без терминов, которые надо гуглить. Без «важно принять свои чувства».
- Опирайся на цифры профиля ниже: тип восприятия, уровень мышления,
  слабый вектор. Если данных мало — так и скажи в одном месте, не
  выдумывай подробностей, которых не знаешь.
- Не льсти и не пугай. Ровный честный тон."""

        profile_data = profile.get('profile_data', {})
        weakest = self._find_weakest_vector(profile.get('behavioral_levels', {}))
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9
Слабая зона: {weakest.get('name', 'не определена')} (уровень {weakest.get('level', 3)})
"""
        response = await self._call_deepseek(system_prompt, user_prompt,
                                             max_tokens=1400, thinking=False)
        return response or self._get_thought_fallback(profile)

    async def generate_questions(self, user_id: int, profile: Dict) -> List[str]:
        if not self.api_key:
            return self._get_questions_fallback()
        system_prompt = """Ты психолог. Сформулируй 5 глубоких вопросов для саморефлексии.
Открытые вопросы, помогают заглянуть внутрь себя.
Формат: список из 5 вопросов, каждый с новой строки. БЕЗ ЭМОДЗИ."""
        profile_data = profile.get('profile_data', {})
        weakest = self._find_weakest_vector(profile.get('behavioral_levels', {}))
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Зона роста: {weakest.get('name', 'не определена')}
"""
        response = await self._call_deepseek(system_prompt, user_prompt,
                                             max_tokens=500, thinking=False)
        if response:
            questions = [q.strip() for q in response.split('\n') if q.strip() and '?' in q]
            return questions[:5] if questions else self._get_questions_fallback()
        return self._get_questions_fallback()

    async def generate_goals(self, user_id: int, profile: Dict, mode: str = "coach") -> List[Dict]:
        if not self.api_key:
            return self._get_goals_fallback(profile, mode)
        mode_names = {"coach": "коуч", "psychologist": "психолог", "trainer": "тренер"}
        system_prompt = f"""Ты {mode_names.get(mode, 'коуч')}. Предложи 5 целей для клиента, подходящих его профилю.
Цели должны:
- Быть конкретными и измеримыми
- Учитывать сильные стороны клиента
- Помогать прорабатывать зоны роста
Формат ответа: JSON массив, каждый объект содержит поля:
- id: уникальный идентификатор (например, goal_1)
- name: название цели (до 50 символов)
- time: предполагаемое время (например, 3-4 недели)
- difficulty: сложность (easy, medium, hard)
Пример:
[{{"id": "fear_work", "name": "Проработать страхи", "time": "3-4 недели", "difficulty": "medium"}}]
НЕ ИСПОЛЬЗУЙ ЭМОДЗИ."""
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3
        profile_data = profile.get('profile_data', {})
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
СБ:{scores.get('СБ',3):.1f} ТФ:{scores.get('ТФ',3):.1f} УБ:{scores.get('УБ',3):.1f} ЧВ:{scores.get('ЧВ',3):.1f}
"""
        response = await self._call_deepseek(system_prompt, user_prompt,
                                             max_tokens=1000, thinking=False)
        if response:
            try:
                m = re.search(r'\[.*\]', response, re.DOTALL)
                if m:
                    goals = json.loads(m.group())
                    return goals[:6] if isinstance(goals, list) else self._get_goals_fallback(profile, mode)
            except json.JSONDecodeError:
                pass
        return self._get_goals_fallback(profile, mode)

    async def generate_weekend_ideas(self, user_id: int, profile: Dict,
                                      context: Dict, scores: Dict = None) -> List[str]:
        if not self.api_key:
            return self._get_ideas_fallback(profile)
        if scores is None:
            scores = {}
            for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                levels = profile.get('behavioral_levels', {}).get(k, [])
                scores[k] = sum(levels) / len(levels) if levels else 3
        system_prompt = """Предложи 5 идей на выходные под психотип. Список из 5 пунктов. БЕЗ ЭМОДЗИ."""
        user_prompt = f"""
Профиль: {profile.get('profile_data', {}).get('display_name', 'не определен')}
СБ:{scores.get('СБ',3):.1f} ТФ:{scores.get('ТФ',3):.1f} УБ:{scores.get('УБ',3):.1f} ЧВ:{scores.get('ЧВ',3):.1f}
Город: {context.get('city', 'не указан') if context else 'не указан'}
"""
        response = await self._call_deepseek(system_prompt, user_prompt,
                                             max_tokens=500, thinking=False)
        if response:
            ideas = [re.sub(r'^[\d\-\*•]\s*', '', l.strip())
                     for l in response.strip().split('\n')
                     if l.strip() and len(l.strip()) > 10]
            return ideas[:5] if ideas else self._get_ideas_fallback(profile)
        return self._get_ideas_fallback(profile)

    # ============================================
    # ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    # ============================================

    def _clean_for_voice(self, text: str) -> str:
        """
        Очистка текста для голосового вывода.
        Исправляет склеенные слова — DeepSeek иногда убирает пробелы после пунктуации.
        """
        if not text:
            return text

        # Убираем маркдаун
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)

        # Убираем эмодзи
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F700-\U0001F77F"
            "\U0001F780-\U0001F7FF"
            "\U0001F800-\U0001F8FF"
            "\U0001F900-\U0001F9FF"
            "\U0001FA00-\U0001FA6F"
            "\U0001FA70-\U0001FAFF"
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text)

        # Убираем спецсимволы
        text = re.sub(r'[#*_`~<>|@$%^&+={}\[\]\\]', '', text)

        # ФИХ СКЛЕЕННЫХ СЛОВ:
        # Добавляем пробел после знаков препинания если его нет
        text = re.sub(r'([.!?,;:])([^\s\d\)\]\}"\'`])', r'\1 \2', text)

        # Пробел после тире
        text = re.sub(r'([—–])([^\s])', r'\1 \2', text)

        # Разделяем склеенные слова по заглавной кириллице
        text = re.sub(r'([а-яё])([А-ЯЁ])', r'\1 \2', text)

        # Нормализуем пробелы
        text = re.sub(r'\s+', ' ', text)

        return text.rstrip()

    def _get_fallback_response(self, mode: str) -> str:
        """Модель не ответила — говорим это прямо, в любом режиме.

        До 13.09.2026 здесь лежали «ответы-заглушки» под видом живых
        реплик: психологу — «Я с вами. Расскажите подробнее, что вас
        беспокоит», коучу — «Давайте вместе подумаем. Что вы чувствуете?».
        Человек, который только что подробно рассказал о смерти близкого,
        получал в ответ просьбу рассказать подробнее — и так пять раз за
        разговор. Режимы узнают заглушку по is_tech_fail и не списывают за
        неё минуты и бесплатные ответы; фразу под видом ответа они узнать
        не могли."""
        return tech_fail_reply()

    def _get_thought_fallback(self, profile: Dict) -> str:
        # Запасной текст на случай, когда модель недоступна. Он НЕ выдаёт
        # себя за разбор по тесту: подменять персональный анализ общим
        # наблюдением — ровно та ошибка, которую убрали из экрана профиля
        # 13.09.2026. Здесь честно сказано, что это общая мысль, и указано,
        # как получить свою.
        return THOUGHT_FALLBACK

    def _get_ideas_fallback(self, profile: Dict) -> List[str]:
        return [
            "Прогулка по новому маршруту в твоём городе",
            "Встреча с друзьями в неформальной обстановке",
            "Чтение книги, которая давно ждёт своего часа",
            "Мастер-класс или воркшоп по интересной теме",
            "День без гаджетов, посвяти время себе"
        ]

    def _get_goals_fallback(self, profile: Dict, mode: str) -> List[Dict]:
        return [
            {"id": "purpose", "name": "Найти предназначение", "time": "5-7 недель", "difficulty": "hard"},
            {"id": "balance", "name": "Обрести баланс", "time": "4-6 недель", "difficulty": "medium"},
            {"id": "growth", "name": "Личностный рост", "time": "6-8 недель", "difficulty": "medium"}
        ]

    def _get_questions_fallback(self) -> List[str]:
        return [
            "Что для вас сейчас самое важное?",
            "Куда вы хотите прийти через год?",
            "Что мешает вам двигаться к цели?",
            "Какие ресурсы у вас уже есть?",
            "Что вы можете сделать уже сегодня?"
        ]

    def _find_weakest_vector(self, scores: Dict) -> Dict:
        vectors = {
            "СБ": {"name": "Реакция на давление", "level": 3},
            "ТФ": {"name": "Деньги и ресурсы", "level": 3},
            "УБ": {"name": "Понимание мира", "level": 3},
            "ЧВ": {"name": "Отношения", "level": 3}
        }
        for k, v in vectors.items():
            levels = scores.get(k, [])
            if levels:
                vectors[k]["level"] = sum(levels) / len(levels) if isinstance(levels, list) else levels
        return min(vectors.values(), key=lambda x: x["level"])

    def _format_deep_patterns(self, patterns: Dict) -> str:
        if not patterns:
            return "Данные отсутствуют"
        lines = []
        if patterns.get('attachment'):
            lines.append(f"Привязанность: {patterns['attachment']}")
        if patterns.get('defense_mechanisms'):
            lines.append(f"Защиты: {', '.join(patterns['defense_mechanisms'])}")
        if patterns.get('core_beliefs'):
            lines.append(f"Убеждения: {', '.join(patterns['core_beliefs'])}")
        return "\n".join(lines) if lines else "Данные отсутствуют"

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
