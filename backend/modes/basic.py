#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py) - Великий Комбинатор
Режим для пользователей, которые еще не прошли тест.
Фреди в образе Остапа Бендера с использованием DeepSeek.

Версия 2.1 — компактная + многоуровневый анализ + чтение между строк + TTS-friendly
"""

import re
import logging
import random
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, AsyncGenerator, List, Optional

from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):
    """
    Великий Комбинатор — Остап Бендер 2.0
    - Читает между строк (скрытый контекст)
    - Многоуровневый анализ: правила → закономерности → тенденции → мейнстримы → судьбы → рок
    - Запоминает противоречия и золотые фразы
    - Чистит текст для TTS без разрыва слов
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        # Минимальные данные для Бендера
        minimal_data = {
            "profile_data": {},
            "perception_type": user_data.get("perception_type", "не определен"),
            "thinking_level": user_data.get("thinking_level", 5),
            "behavioral_levels": user_data.get("behavioral_levels", {}),
            "deep_patterns": {},
            "confinement_model": None,
            "history": user_data.get("history", [])[-15:]
        }
        super().__init__(user_id, minimal_data, context)
        
        self.ai_service = AIService()
        self.user_name = getattr(context, 'name', "") or ""
        self.gender = getattr(context, 'gender', None) if context else None
        
        # Счётчики
        self.message_counter = 0
        self.test_offered = False
        self.conversation_history: List[str] = []
        
        # ========== МНОГОУРОВНЕВЫЙ АНАЛИЗ ==========
        self.rules: List[str] = []           # уровень 1: факты
        self.patterns: List[str] = []        # уровень 2: закономерности
        self.trends: List[str] = []          # уровень 3: тенденции
        self.mainstreams: List[str] = []     # уровень 4: мейнстримы
        self.fates: List[str] = []           # уровень 5: судьбы
        self.rock: List[str] = []            # уровень 6: рок
        
        # Счётчики для каскадного обновления
        self.rule_counter = 0
        self.pattern_counter = 0
        self.trend_counter = 0
        self.mainstream_counter = 0
        self.fate_counter = 0
        self.LEVEL_INTERVAL = 2
        
        # Текущий активный инсайт (самый высокий уровень)
        self.current_insight: Optional[str] = None
        self.current_insight_level: int = 0
        
        # ========== ГЛУБИННЫЙ КОНТЕКСТ ==========
        self.last_question_context: Optional[Dict[str, Any]] = None
        
        # ========== ПАМЯТЬ ==========
        self.golden_phrases: List[str] = []          # сильные фразы пользователя
        self.user_interest_level: int = 50           # заинтересованность (0-100)
        self.user_resistance: int = 0                # отказы от теста
        self.max_resistance: int = 3
        
        logger.info(f"🎭 BasicMode (Бендер 2.1) инициализирован для user_id={user_id}")

    # ====================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ======================
    
    def _get_address(self) -> str:
        """Нейтральное обращение (без привязки к полу)"""
        return random.choice([
            "друг мой", 
            "приятель", 
            "товарищ", 
            "слушай", 
            "дорогой друг",
            "уважаемый",
            "собеседник"
        ])

    def _get_time_greeting(self) -> str:
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "Доброе утро"
        elif 12 <= hour < 17:
            return "Добрый день"
        elif 17 <= hour < 22:
            return "Добрый вечер"
        else:
            return "Ночь на дворе"

    # ====================== МНОГОУРОВНЕВЫЙ АНАЛИЗ ======================
    
    async def _extract_rule(self, message: str) -> Optional[str]:
        """Извлекает правило из сообщения"""
        prompt = f"""Из сообщения человека выдели ОДИН конкретный факт о его жизни или проблеме.
Если факта нет, ответь "НЕТ".

Сообщение: "{message}"

Примеры:
"Начальник бесит" → начальник придирается
"Денег не хватает" → не хватает денег
"Хочу похудеть, но лень" → хочет похудеть, но лень
"Всё нормально" → НЕТ

Правило:"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=50, temperature=0.5)
        if response and response.strip() != "НЕТ" and len(response) > 3:
            return response.strip()
        return None

    async def _extract_pattern(self, rules: List[str]) -> Optional[str]:
        """Из двух правил → закономерность"""
        prompt = f"""Найди общую закономерность в двух фактах.

Факт 1: {rules[0]}
Факт 2: {rules[1]}

Примеры:
"начальник придирается", "жене не нравится зарплата" → его достают со всех сторон
"не хватает денег", "зарплату задерживают" → с деньгами напряг

Закономерность (одно предложение, до 12 слов, без психологии):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.8)
        if response and len(response) > 5:
            return response.strip()
        return None

    async def _extract_trend(self, patterns: List[str]) -> Optional[str]:
        prompt = f"""Найди общую тенденцию в двух закономерностях.

Закономерность 1: {patterns[0]}
Закономерность 2: {patterns[1]}

Пример: "его достают со всех сторон", "везде проблемы" → жизнь превращается в нервотрёпку

Тенденция (одно предложение, до 15 слов):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=80, temperature=0.8)
        if response and len(response) > 5:
            return response.strip()
        return None

    async def _extract_mainstream(self, trends: List[str]) -> Optional[str]:
        prompt = f"""Найди общий мейнстрим в двух тенденциях.

Тенденция 1: {trends[0]}
Тенденция 2: {trends[1]}

Пример: "жизнь превращается в нервотрёпку", "финансовая нестабильность" → жизнь бьёт ключом по голове

Мейнстрим (одно предложение, до 12 слов, с иронией):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=70, temperature=0.85)
        if response and len(response) > 5:
            return response.strip()
        return None

    async def _extract_fate(self, mainstreams: List[str]) -> Optional[str]:
        prompt = f"""Сделай вывод о судьбе человека.

Мейнстрим 1: {mainstreams[0]}
Мейнстрим 2: {mainstreams[1]}

Пример: "жизнь бьёт ключом по голове", "топтание на месте" → так и будет маяться, пока не надоест

Судьба (одно ёмкое предложение, до 10 слов, с юмором):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.85)
        if response and len(response) > 5:
            return response.strip()
        return None

    async def _extract_rock(self, fates: List[str]) -> Optional[str]:
        prompt = f"""Сделай вывод о роке человека.

Судьба 1: {fates[0]}
Судьба 2: {fates[1]}

Пример: "так и будет маяться", "пока не надоест" → обречён на вечные страдания с переменным успехом

Рок (одно предложение, до 10 слов, с чёрным юмором):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.9)
        if response and len(response) > 5:
            return response.strip()
        return None

    async def _update_analysis_levels(self):
        """Каскадное обновление всех уровней анализа"""
        # Правила → закономерности
        while len(self.rules) >= self.LEVEL_INTERVAL and self.rule_counter < len(self.rules):
            pattern = await self._extract_pattern(self.rules[-self.LEVEL_INTERVAL:])
            if pattern:
                self.patterns.append(pattern)
                self.rule_counter += self.LEVEL_INTERVAL
                logger.info(f"🔍 Закономерность: {pattern}")
            else:
                break
        
        # Закономерности → тенденции
        while len(self.patterns) >= self.LEVEL_INTERVAL and self.pattern_counter < len(self.patterns):
            trend = await self._extract_trend(self.patterns[-self.LEVEL_INTERVAL:])
            if trend:
                self.trends.append(trend)
                self.pattern_counter += self.LEVEL_INTERVAL
                logger.info(f"📈 Тенденция: {trend}")
            else:
                break
        
        # Тенденции → мейнстримы
        while len(self.trends) >= self.LEVEL_INTERVAL and self.trend_counter < len(self.trends):
            ms = await self._extract_mainstream(self.trends[-self.LEVEL_INTERVAL:])
            if ms:
                self.mainstreams.append(ms)
                self.trend_counter += self.LEVEL_INTERVAL
                logger.info(f"🎯 Мейнстрим: {ms}")
            else:
                break
        
        # Мейнстримы → судьбы
        while len(self.mainstreams) >= self.LEVEL_INTERVAL and self.mainstream_counter < len(self.mainstreams):
            fate = await self._extract_fate(self.mainstreams[-self.LEVEL_INTERVAL:])
            if fate:
                self.fates.append(fate)
                self.mainstream_counter += self.LEVEL_INTERVAL
                logger.info(f"🔮 Судьба: {fate}")
            else:
                break
        
        # Судьбы → рок
        while len(self.fates) >= self.LEVEL_INTERVAL and self.fate_counter < len(self.fates):
            rock = await self._extract_rock(self.fates[-self.LEVEL_INTERVAL:])
            if rock:
                self.rock.append(rock)
                self.fate_counter += self.LEVEL_INTERVAL
                logger.info(f"⚡ Рок: {rock}")
            else:
                break
        
        # Обновляем текущий инсайт
        if self.rock:
            self.current_insight = self.rock[-1]
            self.current_insight_level = 6
        elif self.fates:
            self.current_insight = self.fates[-1]
            self.current_insight_level = 5
        elif self.mainstreams:
            self.current_insight = self.mainstreams[-1]
            self.current_insight_level = 4
        elif self.trends:
            self.current_insight = self.trends[-1]
            self.current_insight_level = 3
        elif self.patterns:
            self.current_insight = self.patterns[-1]
            self.current_insight_level = 2
        else:
            self.current_insight = None
            self.current_insight_level = 0

    # ====================== ГЛУБИННЫЙ КОНТЕКСТ ======================
    
    async def _extract_deep_context(self, question: str) -> Dict[str, Any]:
        """Извлекает скрытую потребность и эмоциональный тон"""
        prompt = f"""Проанализируй вопрос и определи:

1. ЯВНЫЙ ВОПРОС: что спрашивает буквально
2. СКРЫТАЯ ПОТРЕБНОСТЬ: что на самом деле беспокоит
3. ЭМОЦИОНАЛЬНЫЙ ТОН: тревога, злость, надежда, любопытство, спокойствие
4. СРОЧНОСТЬ: от 0 до 10

Вопрос: "{question}"

Формат ответа:
Явный: [текст]
Скрытая потребность: [текст]
Эмоциональный тон: [текст]
Срочность: [число]"""

        response = await self.ai_service._simple_call(prompt, max_tokens=150, temperature=0.6)
        
        if not response:
            return {"explicit": question, "implicit": "не определена", "emotional_tone": "нейтральный", "urgency": 5}
        
        context = {"explicit": "", "implicit": "", "emotional_tone": "нейтральный", "urgency": 5}
        for line in response.split('\n'):
            if line.startswith("Явный:"):
                context["explicit"] = line.replace("Явный:", "").strip()
            elif line.startswith("Скрытая потребность:"):
                context["implicit"] = line.replace("Скрытая потребность:", "").strip()
            elif line.startswith("Эмоциональный тон:"):
                context["emotional_tone"] = line.replace("Эмоциональный тон:", "").strip()
            elif line.startswith("Срочность:"):
                try:
                    num = re.search(r'\d+', line)
                    if num:
                        context["urgency"] = min(10, int(num.group()))
                except:
                    pass
        return context

    # ====================== ЗОЛОТЫЕ ФРАЗЫ И ПРОТИВОРЕЧИЯ ======================
    
    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
        prompt = f"""Выдели из сообщения самую сильную, показательную фразу.
Если такой нет, ответь "НЕТ".

Сообщение: {text}

Фраза (до 10 слов):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.6)
        if response and response.strip() != "НЕТ" and len(response) > 5:
            return response.strip()
        return None

    async def _find_contradiction(self, new_rule: str) -> Optional[str]:
        """Ищет противоречие с предыдущими правилами"""
        if len(self.rules) < 2:
            return None
        for old_rule in self.rules[-5:]:
            if old_rule == new_rule:
                continue
            prompt = f"""Есть ли противоречие между этими утверждениями?
1: {old_rule}
2: {new_rule}
Если да, напиши короткую фразу с иронией. Если нет, ответь "НЕТ"."""

            response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.7)
            if response and "НЕТ" not in response.upper() and len(response) > 5:
                return response.strip()
        return None

    # ====================== ПРОМПТ ======================
    
    def get_system_prompt(self) -> str:
        return """Ты Фреди — Великий Комбинатор, современный Остап Бендер 2.0.
Твой текст будет озвучиваться голосом.

ВАЖНО: Твой текст будет озвучен синтезатором речи.
Пиши ТОЛЬКО с пробелами между словами. НЕ склеивай слова.
Пример: "как и мои планы" — правильно. "какимоипланы" — неправильно.
Пример: "гибкие и зависят" — правильно. "гибкиеизависят" — неправильно.

Характер: харизматичный, остроумный, слегка нахальный, но обаятельный.
Отвечай коротко (1-2 предложения), но метко.
Почти всегда заканчивай вопросом.
НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию.
Только чистый текст с пробелами.

Обращения (ТОЛЬКО нейтральные, без привязки к полу):
- друг мой
- приятель
- товарищ
- слушай
- дорогой друг
- уважаемый
- собеседник

Теперь отвечай на вопрос пользователя с пробелами между словами."""

    def get_greeting(self) -> str:
        address = self._get_address()
        time_greeting = self._get_time_greeting()
        name_part = f", {self.user_name}" if self.user_name else ""
        return f"{time_greeting}{name_part}, {address}. Я Фреди, великий комбинатор. Чую в тебе что-то интересное. Любовь, деньги, слава или бананы?"

    def _build_prompt(self, question: str) -> str:
        """Собирает всё: контекст, инсайты, золотые фразы"""
        address = self._get_address()
        history = "\n".join(self.conversation_history[-6:])
        
        # Секция инсайта
        insight_text = ""
        if self.current_insight:
            level_names = {2: "закономерность", 3: "тенденция", 4: "мейнстрим", 5: "судьба", 6: "рок"}
            level_name = level_names.get(self.current_insight_level, "закономерность")
            insight_text = f"Я заметил {level_name}: {self.current_insight}\n"
        
        # Секция золотых фраз
        golden_text = ""
        if self.golden_phrases:
            golden_text = f"Помню его слова: {self.golden_phrases[-1]}\n"
        
        # Секция скрытого контекста
        context_text = ""
        if self.last_question_context and self.last_question_context.get("implicit") != "не определена":
            context_text = f"Скрытая потребность: {self.last_question_context['implicit']}\n"
        
        return f"""{self.get_system_prompt()}

{insight_text}{golden_text}{context_text}
История разговора:
{history}

Сообщение пользователя: {question}

Отвечай естественно, коротко и точно в точку.
Слышь между строк настоящую эмоцию или проблему.
Обязательно заканчивай вопросом."""

    # ====================== ОСНОВНОЙ МЕТОД (БЕЗ СТРИМИНГА) ======================
    
    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        """Главный метод — анализирует, запоминает, отвечает (без стриминга)"""
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        # 1. Глубинный контекст
        self.last_question_context = await self._extract_deep_context(question)
        logger.info(f"📊 Контекст: {self.last_question_context['implicit'][:50]} | эмоция: {self.last_question_context['emotional_tone']}")
        
        # 2. Извлечение правила
        rule = await self._extract_rule(question)
        if rule:
            self.rules.append(rule)
            logger.info(f"📝 Правило {len(self.rules)}: {rule}")
            
            contradiction = await self._find_contradiction(rule)
            if contradiction:
                logger.info(f"⚠️ Противоречие: {contradiction}")
            
            await self._update_analysis_levels()
            if self.current_insight:
                logger.info(f"🎯 Инсайт ур.{self.current_insight_level}: {self.current_insight}")
        
        # 3. Золотая фраза
        golden = await self._extract_golden_phrase(question)
        if golden:
            self.golden_phrases.append(golden)
            logger.info(f"✨ Золотая фраза: {golden}")
        
        # 4. Обновляем интерес
        if self.last_question_context.get("urgency", 0) > 7:
            self.user_interest_level = min(100, self.user_interest_level + 15)
        
        # 5. Предложение теста
        if self.message_counter >= 4 and not self.test_offered and self.user_resistance < self.max_resistance:
            self.test_offered = True
            yield f"{self._get_address()}, слушай... У меня есть один интересный тест минут на 10–12. Хочешь узнать свой настоящий код личности?"
            await asyncio.sleep(0.02)
            return
        
        # 6. Согласие на тест
        if re.search(r'(да|хочу|давай|погнали|рискну|ок|тест)', question.lower()) and self.test_offered:
            yield "Отлично! Тогда первый вопрос..."
            return
        
        # 7. Отказ
        if re.search(r'(нет|не хочу|потом|отстань|не надо)', question.lower()):
            self.user_resistance += 1
            self.test_offered = False
            address = self._get_address()
            yield f"{address}, не хочешь — не надо. Дверь открыта. А пока о чём ещё поговорим?"
            return
        
        # 8. Формируем промпт
        full_prompt = self._build_prompt(question)
        
        # 9. Вызываем DeepSeek БЕЗ СТРИМИНГА (один цельный ответ)
        try:
            response = await self.ai_service._simple_call(
                prompt=full_prompt,
                max_tokens=130,
                temperature=0.90
            )
            
            if response and response.strip():
                # Только нормализация пробелов
                clean_response = re.sub(r'\s+', ' ', response.strip())
                yield clean_response
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            address = self._get_address()
            yield f"{address}, интересный вопрос. Расскажи подробнее."

    # ====================== ЗАГЛУШКА ======================
    
    def process_question(self, question: str):
        return {"response": "Бендер работает в streaming-режиме", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(Bender, msgs={self.message_counter}, rules={len(self.rules)}, insight={self.current_insight_level})>"
