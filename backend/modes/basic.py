#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BasicMode - Fredi with Bikovic voice, memory, emotions.
Primary LLM: Anthropic Claude. Fallback: DeepSeek.
"""

import re
import logging
import random
import asyncio
from datetime import datetime
from typing import Dict, Any, AsyncGenerator, List, Optional

from modes.base_mode import BaseMode
from services.ai_service import AIService

# Поведенческие правила Фреди — общие для всех режимов. В BasicMode профиль
# юзера ещё не пройден, но запреты на шаблонные открывашки, переадресацию
# к специалистам и обязанность вести к действию работают так же.
try:
    from .prompts.psychologist.base import BEHAVIORAL_GUARD as _BEHAVIORAL_GUARD
except Exception:
    _BEHAVIORAL_GUARD = ""

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        minimal_data = {
            "profile_data": {},
            "perception_type": user_data.get("perception_type", "not defined"),
            "thinking_level": user_data.get("thinking_level", 5),
            "behavioral_levels": user_data.get("behavioral_levels", {}),
            "deep_patterns": {},
            "confinement_model": None,
            "history": user_data.get("history", [])[-15:]
        }
        super().__init__(user_id, minimal_data, context)

        self.ai_service = AIService()
        self.user_name = getattr(context, "name", "") or ""
        self.gender = getattr(context, "gender", None) if context else None
        self.message_counter = user_data.get("message_count", 0)
        self.test_offered = user_data.get("test_offered", False)
        # Активный пресет промпта BasicMode (current/jarvis/house).
        # Прокидывается из main.py перед созданием mode_instance.
        # При отсутствии — fallback на 'current'.
        self._preset_key = (user_data.get("basic_mode_preset") or "current").strip().lower()
        self.conversation_history: List[str] = []
        self.rules: List[str] = []
        self.golden_phrases: List[str] = []
        self._memory = None
        self._emotion = None
        self._memory_text = ""
        # Cross-session memory: блок-сводка прошлых сессий (psychologist/coach/
        # trainer уже подключены, BasicMode подключаем тем же паттерном).
        self._cross_memory = ""
        self._current_emotion = {"emotion": "neutral", "tone": "friendly", "instruction": ""}

        logger.info(f"BasicMode init user_id={user_id}, msgs={self.message_counter}")

    async def _call_llm(self, prompt: str, max_tokens: int = 150, temperature: float = 0.8) -> Optional[str]:
        """Call Anthropic first, fallback to DeepSeek."""
        try:
            from services.anthropic_client import call_anthropic, is_available
            if is_available():
                result = await call_anthropic(prompt, max_tokens=max_tokens, temperature=temperature)
                if result:
                    return result
                logger.info("Anthropic failed, falling back to DeepSeek")
        except Exception as e:
            logger.warning(f"Anthropic import/call error: {e}")

        return await self.ai_service._simple_call(prompt, max_tokens=max_tokens, temperature=temperature)

    async def _get_memory(self):
        if self._memory is None:
            try:
                from services.user_memory import get_user_memory
                self._memory = get_user_memory()
            except Exception:
                pass
        return self._memory

    async def _get_emotion_detector(self):
        if self._emotion is None:
            try:
                from services.emotion_detector import EmotionDetector
                self._emotion = EmotionDetector()
            except Exception:
                pass
        return self._emotion

    async def _load_memory(self):
        mem = await self._get_memory()
        if mem:
            try:
                self._memory_text = await mem.get_facts_text(self.user_id)
            except Exception:
                self._memory_text = ""

    async def _load_cross_session_memory(self) -> None:
        """Кросс-сессионная память: подгружаем сводки прошлых закрытых сессий
        и в фоне суммаризуем сессию, которая только что закрылась.
        Тот же паттерн, что в psychologist/coach/trainer."""
        try:
            from session_memory import (
                load_memory_block,
                schedule_summarize_in_background,
            )
            self._cross_memory = await load_memory_block(self.user_id) or ""
            schedule_summarize_in_background(self.user_id)
        except Exception as e:
            logger.debug(f"session_memory load failed in BasicMode: {e}")
            self._cross_memory = ""

    async def _save_fact(self, fact: str):
        mem = await self._get_memory()
        if mem and fact:
            try:
                await mem.store_fact(self.user_id, fact)
            except Exception:
                pass

    async def _detect_emotion(self, text: str):
        detector = await self._get_emotion_detector()
        if detector:
            try:
                self._current_emotion = await detector.detect(text)
            except Exception:
                pass

    def _get_address(self) -> str:
        # Нейтральные обращения без шаблонных открывашек («Знаешь / Слушай /
        # Дай-ка / Мне кажется» запрещены BEHAVIORAL_GUARD).
        return random.choice(["хорошо", "ясно", "понимаю", "ладно", "ок"])

    def _get_time_greeting(self) -> str:
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "Доброе утро"
        elif 12 <= hour < 17:
            return "Добрый день"
        elif 17 <= hour < 22:
            return "Добрый вечер"
        else:
            return "Доброй ночи"

    async def _extract_rule(self, message: str) -> Optional[str]:
        # Анти-ложь: если в сообщении упоминается, что это слова/действия
        # другого человека (сестра/мама/брат/сын/...), факт НЕ извлекаем —
        # иначе он попадёт в долгосрочную память как факт о собеседнике.
        # Это закрывает галлюцинации типа «слова сестры приписаны юзеру».
        _msg_low = (message or "").lower()
        _third_person_re = re.compile(
            r"\b(он|она|они|это\s+(?:сказал|сказала|говорил|говорила|"
            r"спросил|спросила)|"
            r"мо(?:й|я|и)\s+(?:сын|дочь|брат|сестра|мама|папа|"
            r"мать|отец|жена|муж|друг|подруга|коллега|сосед(?:ка)?|"
            r"бабушка|дедушка|ребёнок|ребенок|тётя|тетя|дядя)|"
            r"(?:сын|дочь|брат|сестра|мама|папа|мать|отец|жена|муж|друг|"
            r"подруга|коллега|сосед(?:ка)?|бабушка|дедушка|тётя|тетя|дядя)\s+"
            r"(?:сказал|сказала|говорил|говорила|спросил|спросила|написал))"
        )
        if _third_person_re.search(_msg_low):
            return None

        prompt = (
            "Из сообщения человека выдели ОДИН конкретный факт о его жизни или проблеме.\n"
            "Если в сообщении человек цитирует или передаёт чужие слова, или говорит\n"
            "о другом человеке (сын/брат/мама/коллега/сестра и т.п.), ответь НЕТ —\n"
            "это НЕ факт о собеседнике.\n"
            "Если факта нет, ответь НЕТ.\n\n"
            f"Сообщение: \"{message}\"\n\nПравило:"
        )
        response = await self.ai_service._simple_call(prompt, max_tokens=50, temperature=0.5)
        if response and response.strip() != "НЕТ" and len(response) > 3:
            return response.strip()
        return None

    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
        prompt = (
            "Выдели из сообщения самую важную мысль.\n"
            "Если такой нет, ответь НЕТ.\n\n"
            f"Сообщение: {text}\n\nМысль (до 10 слов):"
        )
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.6)
        if response and response.strip() != "НЕТ" and len(response) > 5:
            return response.strip()
        return None

    def get_system_prompt(self) -> str:
        # Подгружаем активный пресет (current/jarvis/house) из модуля.
        # Сам ключ кладётся в self._preset_key из user_data в __init__.
        try:
            from .prompts.basic_presets import get_preset_text
            body = get_preset_text(self._preset_key)
        except Exception as _e:
            logger.warning(f"basic_presets import failed, fallback inline: {_e}")
            body = (
                "Ты — Фреди в БАЗОВОМ РЕЖИМЕ. Тест ещё не пройден, профиля у тебя нет.\n"
                "Задача: помочь прямо сейчас и дать почувствовать пользу.\n"
            )
        # Правила работы с долгосрочной памятью — добавляются ко всем
        # пресетам BasicMode. Без них Фреди склеивает события разных
        # сессий и приписывает услышанное от родственников / детей
        # текущему собеседнику.
        memory_guard = (
            "\n=== РАБОТА С ПАМЯТЬЮ ===\n"
            "1. Если факт из памяти противоречит текущей реплике — ВЕРЬ "
            "текущей. Память может быть устаревшей или относиться к другому "
            "человеку, который пользовался устройством.\n"
            "2. Не приписывай услышанное в прошлых сессиях текущему "
            "собеседнику. Если упомянул факт из памяти — обязательно дай "
            "право поправить: «если я путаю — скажи».\n"
            "3. Если собеседник говорит «это не я / это [сестра/брат/сын/"
            "мама/...] / забудь / это другой человек» — извинись коротко "
            "и НЕ возвращайся к этому факту в текущем разговоре. Считай, "
            "что памяти на эту тему у тебя нет.\n"
            "4. Не цитируй факты из памяти подряд в каждом ответе — это "
            "выглядит как сухое досье. Используй точечно, по делу.\n"
            "5. Если в одной сессии разные люди подходят к устройству "
            "(«сейчас Лёва / переключаюсь, это уже Андрей») — обращайся "
            "к тому, кто пишет СЕЙЧАС. Не смешивай контексты.\n"
        )
        # BEHAVIORAL_GUARD приоритетнее любого режима — клеим в начало.
        return f"{_BEHAVIORAL_GUARD}{body}{memory_guard}"

    def get_greeting(self) -> str:
        tg = self._get_time_greeting()
        name = f", {self.user_name}" if self.user_name else ""
        greetings = [
            f"{tg}{name}. Я Фреди. Расскажи, с чем пришёл.",
            f"Привет{name}. Я Фреди. С чего хочешь начать?",
            f"{tg}{name}. Что у тебя сегодня? Расскажи как есть.",
            f"Привет{name}. Я здесь. О чём поговорим?",
            f"{tg}{name}. Расскажи, что происходит — попробую быть полезным.",
        ]
        return random.choice(greetings)

    def _build_user_block(self) -> str:
        """О СОБЕСЕДНИКЕ — чтобы AI знал имя, пол, возраст и мог
        естественно обращаться и отвечать на «что ты обо мне знаешь?»."""
        parts = []
        if self.user_name:
            parts.append(f"Имя: {self.user_name}")
        if self.gender:
            g = "мужчина" if str(self.gender).lower() in ("male", "m", "мужской", "муж") else (
                "женщина" if str(self.gender).lower() in ("female", "f", "женский", "жен") else str(self.gender)
            )
            parts.append(f"Пол: {g}")
        age = getattr(self, "age", None)
        if age:
            parts.append(f"Возраст: {age}")
        if not parts:
            return ""
        return (
            "О СОБЕСЕДНИКЕ:\n" + "\n".join("- " + p for p in parts) + "\n"
            "Обращайся по имени естественно — примерно в каждом 2-3 ответе, без навязчивости. "
            "Если собеседник спросит «что ты обо мне знаешь» / «помнишь меня» / «мы общались» — "
            "ответь тепло: упомяни имя и 1–2 детали из истории ниже, покажи, что помнишь его."
        )

    async def _build_intuition_block(self, question: str) -> str:
        """Подмешивает в системный промпт топ-2-3 паттерна из накопленного
        «жизненного опыта» Фреди (services.life_experience). Чисто
        keyword-матч по in-memory кэшу — без дополнительных LLM-вызовов
        и без сетевых походов кроме первой загрузки кэша."""
        try:
            from services.life_experience import find_relevant_patterns, format_for_prompt
            patterns = await find_relevant_patterns(question, top_n=3)
            return format_for_prompt(patterns)
        except Exception as e:
            logger.debug(f"intuition skip: {e}")
            return ""

    def _build_prompt(self, question: str) -> str:
        history_from_db = ""
        # Расширено до 10 сообщений и до 200 символов каждое — это чище
        # передаёт контекст предыдущих реплик, помогая AI не скатываться
        # в одинаковые ответы при уточняющих вопросах.
        if self.history:
            parts = []
            for m in self.history[-10:]:
                role = "Пользователь" if m.get("role") == "user" else "Фреди"
                parts.append(f"{role}: {m.get('content', '')[:200]}")
            history_from_db = "\n".join(parts)

        session_history = "\n".join(self.conversation_history[-4:])
        combined = (history_from_db + "\n" + session_history).strip()

        rules_text = ""
        if self.rules:
            rules_text = f"\n\nФакты: {', '.join(self.rules[-3:])}\n"

        golden_text = ""
        if self.golden_phrases:
            golden_text = f"\n\nОн говорил: {self.golden_phrases[-1]}\n"

        memory_text = ""
        if self._memory_text:
            memory_text = f"\n\n{self._memory_text}\n"

        emotion_instr = ""
        if self._current_emotion.get("instruction"):
            emotion_instr = (
                f"\n\nЭМОЦИЯ: {self._current_emotion['emotion']}. "
                f"{self._current_emotion['instruction']}\n"
            )

        few_shot = (
            "\nПРИМЕРЫ ХОРОШИХ ОТВЕТОВ (без открывашек, с называнием паттерна):\n\n"
            "Пользователь: Я застрял. Ничего не хочу делать.\n"
            "Фреди: Это часто не лень, а истощение — мозг защищает себя через апатию. "
            "На сегодня дай себе один час «пусто», без планов, и заметь к вечеру: стало "
            "легче или тяжелее. От этой точки построим дальше.\n\n"
            "Пользователь: Не могу удержать внимание на работе. Постоянно отвлекаюсь.\n"
            "Фреди: Дело редко в воле — чаще в среде: телефон рядом, нет паузы между "
            "задачами. Попробуй два дня работать интервалами по 25 минут с обязательной "
            "5-минутной паузой, а телефон на это время — в другую комнату. Через два дня "
            "вернись с цифрами, что вышло.\n\n"
            "Пользователь: Боюсь начальницу. С ней теряюсь и заикаюсь.\n"
            "Фреди: Это не про неё лично — это иерархическая блокировка: голос пропадает в "
            "момент, когда мозг считывает «выше тебя по статусу». Перед следующим разговором "
            "запиши три ключевые мысли, которые хочешь донести — они станут якорем, когда тело "
            "начинает плыть. Что именно она делает, что выбивает сильнее всего?\n\n"
            "Пользователь: Всё хорошо.\n"
            "Фреди: Тогда побудем здесь. Если есть что-то небольшое, что хочется обсудить — "
            "расскажи, а если нет — просто присутствие тоже работа.\n"
        )

        user_block = self._build_user_block()
        # Блок «интуиции» по похожим разговорам — заполняется заранее в
        # process_question_streaming, тут просто читаем поле.
        intuition_block = getattr(self, "_intuition_block", "") or ""
        # Cross-session memory клеим в самое начало — так же, как в
        # psychologist/coach/trainer (см. _prepend_memory). Если блока нет,
        # _cross_memory == "" и ничего не меняется.
        return (
            f"{self._cross_memory}{self.get_system_prompt()}\n\n{intuition_block}{user_block}\n{few_shot}\n"
            f"{memory_text}{rules_text}{golden_text}{emotion_instr}\n"
            f"История:\n{combined}\n\n"
            f"Пользователь: {question}\n\n"
            "Ответь без шаблонных открывашек. Объём — по теме: 2–3 предложения "
            "на простой запрос, до 5–6 на серьёзный. Назови паттерн прямо, дай "
            "1–2 применимых шага. Адаптируй тон под эмоцию."
        )

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        if self.message_counter == 1:
            await self._load_memory()
            # Кросс-сессионная память: подмешиваем сводки прошлых сессий и
            # в фоне суммаризуем закрытую сессию (если такая есть).
            await self._load_cross_session_memory()

        # PARALLEL: emotion + rule + golden + intuition (saves 2-4 sec).
        # intuition — keyword-матч поверх кэша life_experience, сетевой поход
        # только при первой загрузке кэша за час. Дополнительных LLM-вызовов
        # не делает — экономия по проекту.
        emotion_task = asyncio.create_task(self._detect_emotion(question))
        rule_task = asyncio.create_task(self._extract_rule(question))
        golden_task = asyncio.create_task(self._extract_golden_phrase(question))
        intuition_task = asyncio.create_task(self._build_intuition_block(question))
        await asyncio.gather(emotion_task, rule_task, golden_task, intuition_task, return_exceptions=True)

        rule = rule_task.result() if not rule_task.cancelled() else None
        golden = golden_task.result() if not golden_task.cancelled() else None
        self._intuition_block = (
            intuition_task.result() if not intuition_task.cancelled() else ""
        ) or ""

        if rule and isinstance(rule, str):
            self.rules.append(rule)
            asyncio.create_task(self._save_fact_bg(rule))

        if golden and isinstance(golden, str):
            self.golden_phrases.append(golden)

        # Если в памяти юзера уже есть отметка «тест пройден / не предлагать» —
        # выставляем флаг и больше не оффер'им. Память подгружается на 1-м
        # сообщении сессии (см. _load_memory выше).
        if not self.test_offered and self._memory_text:
            _mem_low = self._memory_text.lower()
            if (
                "test_already_passed_or_refused" in _mem_low
                or "тест уже пройден" in _mem_low
                or "не предлагать тест" in _mem_low
            ):
                self.test_offered = True

        q_lower = question.lower()

        # 0. Команды «забудь / не моё / это сказала [роль]» — стираем
        #    последние факты из памяти, чтобы Фреди не приписывал
        #    собеседнику услышанное от другого человека или из прошлого
        #    разговора, который к нему не относится.
        _forget_re = (
            r"(\bзабудь\b|сотри\s+(?:это|память|инфо)|стирай|"
            r"это\s+не\s+(?:моё|мое|я|про\s+меня)|"
            r"ко\s+мне\s+(?:это\s+)?не\s+относится|"
            r"(?:говорил[аи]?|сказал[аи]?|сказан[оа]?)\s+"
            r"(?:\S+\s+){0,3}"
            r"(?:не\s+я|сестр|брат|мам|пап|жен|муж|сын|доч|друг|"
            r"подруг|коллег|сосед|бабуш|дедуш|тёт|тет|дяд|"
            r"ребен|ребён))"
        )
        if re.search(_forget_re, q_lower):
            try:
                mem = await self._get_memory()
                if mem and hasattr(mem, "forget_recent"):
                    deleted = await mem.forget_recent(self.user_id, n=5)
                    logger.info(f"BasicMode forget: deleted {deleted} facts for user {self.user_id}")
                # Сбрасываем in-memory правила/golden, чтобы они не подмешались.
                self.rules = []
                self.golden_phrases = []
                self._memory_text = ""
            except Exception as _e:
                logger.warning(f"forget_recent failed: {_e}")
            yield random.choice([
                "Понял, стираю. К этому больше не возвращаюсь.",
                "Хорошо, забыл. Спасибо за поправку.",
                "Принял — это к тебе не относится. Дальше с чистого листа.",
            ])
            return

        # 1. Юзер явно говорит «уже прошёл тест / не нужен / не предлагай»
        #    — выставляем флаг, запоминаем факт навсегда, не «открываем тест».
        #    Условие: в сообщении есть слово «тест» И сигнал, что он либо
        #    уже пройден, либо не нужен / не предлагать. Это надёжнее, чем
        #    единый regex, и ловит «Я уже тест прошёл» без явного «не нужен».
        _test_signal_re = (
            r"(уже\s+прош[её]л|прош[её]л|прохо(?:дил|дила|дили|жу)|"
            r"не\s+нужен|не\s+нужно|не\s+нужна|не\s+надо|"
            r"не\s+предлаг|больше\s+не|не\s+спрашивай|не\s+интересн|"
            r"отстань|хватит\s+про|больше\s+не\s+нужн)"
        )
        if "тест" in q_lower and re.search(_test_signal_re, q_lower):
            self.test_offered = True
            asyncio.create_task(self._save_fact_bg(
                "test_already_passed_or_refused: пользователь сказал, что тест "
                "уже пройден или просит больше его не предлагать"
            ))
            yield random.choice([
                "Понял. Тест больше не предлагаю — просто поговорим.",
                "Ок, без теста. Что у тебя сейчас?",
                "Принял, тест отменяю. Продолжаем разговор.",
            ])
            return

        # 2. Если это вопрос — пропускаем regex-ветки оффера/да-нет и идём
        #    сразу в основной LLM. Иначе «Кто создал ИИ?» уходит в test-loop.
        _question_re = (
            r"\?|^\s*(?:кто|что|как|почему|зачем|где|когда|куда|"
            r"сколько|какой|какая|какие|чей|ты\s+(?:знаешь|можешь|умеешь))\b"
        )
        is_question = bool(re.search(_question_re, question[:120], re.IGNORECASE | re.UNICODE))

        # 3. Оффер на 4-м сообщении — только если не вопрос и оффера ещё не было.
        if self.message_counter >= 4 and not self.test_offered and not is_question:
            self.test_offered = True
            # Оффер преподносим как «давай идти глубже», а не как способ
            # закрыть тему. К этому моменту юзер уже должен был получить
            # содержательный разбор — это требование промпта.
            yield random.choice([
                "Чтобы пойти глубже, есть короткий тест на 10 минут. После него я смогу подбирать слова и подход именно под тебя. Сделаем?",
                "Есть тест на 10 минут — он покажет тип восприятия и слабые места. С ним наш разговор станет точнее. Готов попробовать?",
                "Предлагаю сделать тест — минут десять. Это даст мне твой профиль, и дальше я буду работать с тобой не вслепую. Согласен?",
            ])
            return

        # 4. Согласие — только если оффер уже был и это короткое подтверждение.
        #    Слово «тест» из тригера убрано: «уже прошёл тест» больше не
        #    интерпретируется как «да, открой тест».
        _agree_re = r"(\bда\b|\bхочу\b|\bдавай\b|\bпогнали\b|\bок\b|\bпопробую\b|\bможно\b|\bсогласен\b)"
        _decline_re = r"(\bнет\b|не\s+хочу|потом|отстань|не\s+надо|не\s+сейчас|не\s+интересно)"

        if (
            self.test_offered
            and not is_question
            and re.search(_agree_re, q_lower)
            and not re.search(_decline_re, q_lower)
        ):
            yield random.choice(["Отлично. Давай начнем.", "Хорошо. Тогда начнем.", "Первый вопрос..."])
            return

        # 5. Отказ — снимаем оффер и не зацикливаемся.
        if not is_question and re.search(_decline_re, q_lower):
            if not self.test_offered:
                self.test_offered = True
            yield random.choice([
                "Хорошо. Просто поговорим.",
                "Ладно. Тогда просто побудем здесь.",
                "Нормально. Давай просто поговорим."
            ])
            return

        # Main response: Anthropic -> DeepSeek fallback
        full_prompt = self._build_prompt(question)
        try:
            response = await self._call_llm(full_prompt, max_tokens=300, temperature=0.8)
            if response and response.strip():
                yield self._simple_clean(response)
            else:
                yield random.choice([
                    "Скажи ещё раз — что именно происходит?",
                    "Расскажи подробнее, я хочу понять точно.",
                    "Уточни, на чём конкретно зацепило?",
                ])
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            yield random.choice([
                "Что-то пошло не так на моей стороне. Скажешь ещё раз?",
                "Маленький сбой. Повтори, пожалуйста.",
                "Подожди секунду и попробуй ещё раз — я вернусь.",
            ])

    async def _save_fact_bg(self, fact: str):
        try:
            await self._save_fact(fact)
        except Exception:
            pass

    def _simple_clean(self, text: str) -> str:
        if not text:
            return text
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        text = re.sub(r"__(.*?)__", r"\1", text)
        text = re.sub(r"\*(.*?)\*", r"\1", text)
        text = re.sub(r"_(.*?)_", r"\1", text)
        text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
        text = re.sub(r"`(.*?)`", r"\1", text)
        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F900-\U0001F9FF]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub("", text)
        text = re.sub(r"([.!?,;:])([^\s\d)\]}])", r"\1 \2", text)
        text = re.sub(r"([\u2014\u2013])([^\s])", r"\1 \2", text)
        text = re.sub(r"([a-z\u0430-\u044f\u0451])([A-Z\u0410-\u042f\u0401])", r"\1 \2", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def process_question(self, question: str):
        return {"response": "Basic mode works", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(msgs={self.message_counter}, rules={len(self.rules)})>"
