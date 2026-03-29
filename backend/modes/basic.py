#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py) - Великий Комбинатор
Режим для пользователей, которые еще не прошли тест.
Фреди в образе Остапа Бендера 2.0 с многоуровневым анализом.
"""

import re
import logging
from typing import Dict, Any, Optional, List
from modes.base_mode import BaseMode
from services.ai_service import call_deepseek, call_deepseek_streaming

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):
    """
    Базовый режим для пользователей без теста.
    Фреди в образе Великого Комбинатора (Остап Бендер 2.0)
    Многоуровневый анализ: правило → закономерность → тенденция → мейнстрим → судьба → рок.
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        super().__init__(user_id, user_data, context)

        # Данные пользователя
        self.gender = getattr(context, 'gender', None) if context else None
        self.user_name = getattr(context, 'name', "") or ""

        # Состояние диалога
        self.dialog_stage = "greeting"
        self.conversation_history: List[str] = []

        # ========== МНОГОУРОВНЕВЫЙ АНАЛИЗ ==========
        self.rules: List[str] = []          # уровень 1: факты
        self.patterns: List[str] = []       # уровень 2: закономерности
        self.trends: List[str] = []         # уровень 3: тенденции
        self.mainstreams: List[str] = []    # уровень 4: мейнстримы
        self.fates: List[str] = []          # уровень 5: судьбы
        self.rock: List[str] = []           # уровень 6: рок

        # Счётчики обработанных пар (чтобы не анализировать одни и те же данные дважды)
        self.processed_rules = 0
        self.processed_patterns = 0
        self.processed_trends = 0
        self.processed_mainstreams = 0
        self.processed_fates = 0

        self.current_insight: Optional[str] = None
        self.current_insight_level: int = 0  # 0..6

        self.message_counter = 0
        self.LEVEL_INTERVAL = 2

        logger.info(f"🎭 BasicMode (Великий Комбинатор) инициализирован для user_id={user_id}")

    def _get_address(self) -> str:
        """Возвращает обращение в зависимости от пола"""
        if self.gender == "male":
            return "братец"
        elif self.gender == "female":
            return "голубушка"
        return "друг мой"

    # ====================== УРОВНИ АНАЛИЗА ======================

    async def _extract_rule(self, message: str) -> Optional[str]:
        """Уровень 1: Извлекает один конкретный факт"""
        prompt = f"""Извлеки ОДИН конкретный факт о жизни или проблеме человека (максимум 8 слов).
Если конкретного факта нет — верни ровно "НЕТ".

Сообщение: "{message}"
Правило:"""

        response = await call_deepseek(prompt, max_tokens=50, temperature=0.5)
        cleaned = (response or "").strip()
        return cleaned if cleaned != "НЕТ" and len(cleaned) > 3 else None

    async def _extract_pattern(self, rules: List[str]) -> Optional[str]:
        """Уровень 2: Закономерность из двух правил"""
        prompt = f"""Два факта:
1. {rules[0]}
2. {rules[1]}

Найди общую закономерность. Одно предложение, максимум 12 слов, простым языком, с лёгкой иронией.

Закономерность:"""
        response = await call_deepseek(prompt, max_tokens=60, temperature=0.8)
        return response.strip() if response and len(response.strip()) > 5 else None

    async def _extract_trend(self, patterns: List[str]) -> Optional[str]:
        """Уровень 3: Тенденция"""
        prompt = f"""Две закономерности:
1. {patterns[0]}
2. {patterns[1]}

Найди общую тенденцию. Одно предложение, максимум 15 слов, житейский язык, лёгкая ирония.

Тенденция:"""
        response = await call_deepseek(prompt, max_tokens=80, temperature=0.8)
        return response.strip() if response and len(response.strip()) > 5 else None

    async def _extract_mainstream(self, trends: List[str]) -> Optional[str]:
        """Уровень 4: Мейнстрим (в стиле Бендера)"""
        prompt = f"""Две тенденции:
1. {trends[0]}
2. {trends[1]}

Найди общий мейнстрим. Одно предложение, максимум 12 слов, с иронией и сарказмом в стиле Остапа Бендера.

Мейнстрим:"""
        response = await call_deepseek(prompt, max_tokens=70, temperature=0.85)
        return response.strip() if response and len(response.strip()) > 5 else None

    async def _extract_fate(self, mainstreams: List[str]) -> Optional[str]:
        """Уровень 5: Судьба"""
        prompt = f"""Два мейнстрима:
1. {mainstreams[0]}
2. {mainstreams[1]}

Сделай вывод о судьбе. Одно ёмкое предложение, максимум 10 слов, с юмором, но без жестокости.

Судьба:"""
        response = await call_deepseek(prompt, max_tokens=60, temperature=0.85)
        return response.strip() if response and len(response.strip()) > 5 else None

    async def _extract_rock(self, fates: List[str]) -> Optional[str]:
        """Уровень 6: Рок"""
        prompt = f"""Две судьбы:
1. {fates[0]}
2. {fates[1]}

Сделай вывод о роке человека. Одно предложение, максимум 10 слов, с чёрным юмором, как приговор.

Рок:"""
        response = await call_deepseek(prompt, max_tokens=60, temperature=0.9)
        return response.strip() if response and len(response.strip()) > 5 else None

    # ====================== КАСКАДНОЕ ОБНОВЛЕНИЕ УРОВНЕЙ ======================

    async def _update_analysis_levels(self):
        """Каскадное обновление уровней анализа"""
        updated = False

        # Уровень 2
        while len(self.rules) - self.processed_rules >= self.LEVEL_INTERVAL:
            pair = self.rules[-2:]
            pattern = await self._extract_pattern(pair)
            if pattern:
                self.patterns.append(pattern)
                self.processed_rules += self.LEVEL_INTERVAL
                updated = True
                logger.info(f"🔍 Закономерность: {pattern}")
            else:
                break

        # Уровень 3
        while len(self.patterns) - self.processed_patterns >= self.LEVEL_INTERVAL:
            pair = self.patterns[-2:]
            trend = await self._extract_trend(pair)
            if trend:
                self.trends.append(trend)
                self.processed_patterns += self.LEVEL_INTERVAL
                updated = True
                logger.info(f"📈 Тенденция: {trend}")
            else:
                break

        # Уровень 4
        while len(self.trends) - self.processed_trends >= self.LEVEL_INTERVAL:
            pair = self.trends[-2:]
            mainstream = await self._extract_mainstream(pair)
            if mainstream:
                self.mainstreams.append(mainstream)
                self.processed_trends += self.LEVEL_INTERVAL
                updated = True
                logger.info(f"🎯 Мейнстрим: {mainstream}")
            else:
                break

        # Уровень 5
        while len(self.mainstreams) - self.processed_mainstreams >= self.LEVEL_INTERVAL:
            pair = self.mainstreams[-2:]
            fate = await self._extract_fate(pair)
            if fate:
                self.fates.append(fate)
                self.processed_mainstreams += self.LEVEL_INTERVAL
                updated = True
                logger.info(f"🔮 Судьба: {fate}")
            else:
                break

        # Уровень 6
        while len(self.fates) - self.processed_fates >= self.LEVEL_INTERVAL:
            pair = self.fates[-2:]
            rock = await self._extract_rock(pair)
            if rock:
                self.rock.append(rock)
                self.processed_fates += self.LEVEL_INTERVAL
                updated = True
                logger.info(f"⚡ Рок: {rock}")
            else:
                break

        if updated:
            self._update_current_insight()

    def _update_current_insight(self):
        """Определяет самый высокий активный инсайт"""
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

    # ====================== ПРОМПТЫ ======================

    def get_system_prompt(self) -> str:
        """Системный промпт в стиле Остапа Бендера"""
        return """Ты Фреди — Великий Комбинатор, современный Остап Бендер. 
Твой текст будет озвучиваться, поэтому говори чистым текстом без эмодзи, звёздочек, списков и спецсимволов.

Характер: харизматичный, остроумный, слегка наглый, но очень обаятельный. 
Говоришь коротко, с лёгкой иронией и житейской мудростью. 
Не психолог, а комбинатор и жизненный философ.

Обращения:
- к девушке: голубушка, сестричка, красавица, мадам
- к мужчине: братец, сударь, командор, красавчик
- нейтрально: друг мой, дорогой товарищ

Отвечай 1-3 предложениями. В конце почти всегда вопрос или предложение продолжить разговор.
Мягко и с юмором подводи к тесту, но не дави."""

    def _build_prompt(self, question: str) -> str:
        """Собирает полный промпт с текущим инсайтом"""
        system = self.get_system_prompt()

        insight_section = ""
        if self.current_insight and self.current_insight_level >= 2:
            level_names = {2: "закономерность", 3: "тенденцию", 4: "мейнстрим", 5: "судьбу", 6: "рок"}
            level_name = level_names.get(self.current_insight_level, "закономерность")
            insight_section = f"""
Я уже заметил про человека {level_name}:
"{self.current_insight}"

Обыграй это в ответе легко и с иронией, не перечисляя все факты. Просто намекни на общую картину."""

        return f"""{system}

{insight_section}

Вопрос пользователя: {question}

Ответь коротко, остроумно и в характере."""

    def get_greeting(self) -> str:
        """Приветствие"""
        address = self._get_address()
        name_part = f", {self.user_name}" if self.user_name else ""
        return f"Привет{name_part}, {address}. Я Фреди, великий комбинатор. Чую в тебе что-то интересное. Любовь, деньги, слава или бананы?"

    # ====================== ОСНОВНОЙ МЕТОД ======================

    async def process_question_streaming(self, question: str):
        """Основной потоковый обработчик"""
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        # Проверка на желание пройти тест
        if re.search(r"(да|хочу|давай|рискну|сыграем|тест|погнали|ок|хорошо)", question.lower()):
            if self.dialog_stage in ["greeting", "exploration", "test_offered"]:
                self.dialog_stage = "test_offered"
                yield "Отлично, тогда первый вопрос..."
                return

        # Проверка на отказ
        if re.search(r"(нет|не хочу|потом|отстань|не надо|не нужно)", question.lower()):
            self.dialog_stage = "exploration"
            yield f"{self._get_address()}, не хочешь — не надо. Дверь всегда открыта. О чём ещё поболтаем?"
            return

        # Анализ сообщения и обновление уровней
        rule = await self._extract_rule(question)
        if rule:
            self.rules.append(rule)
            await self._update_analysis_levels()

        if self.dialog_stage == "greeting":
            self.dialog_stage = "exploration"

        # Генерация ответа
        prompt = self._build_prompt(question)

        try:
            async for chunk in call_deepseek_streaming(prompt, max_tokens=180, temperature=0.85):
                clean_chunk = self._clean_for_tts(chunk)
                if clean_chunk.strip():
                    yield clean_chunk
        except Exception as e:
            logger.error(f"Streaming error in BasicMode: {e}")
            yield f"{self._get_address()}, вопрос интересный. Знаешь, у меня есть один тест на пятнадцать минут. Рискнёшь узнать свой код?"

        self.dialog_stage = "exploration"

    def _clean_for_tts(self, text: str) -> str:
        """Очистка текста для озвучки"""
        if not text:
            return ""

        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)

        # Удаление эмодзи
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
            "]+", flags=re.UNICODE)
        text = emoji_pattern.sub('', text)

        text = re.sub(r'[#*_`~<>|@$%^&+={}[\]\\|]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def process_question(self, question: str) -> Dict[str, Any]:
        """Синхронная заглушка для совместимости с BaseMode"""
        return {
            "response": "",
            "tools_used": [],
            "follow_up": False,
            "suggestions": [],
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }

    def __repr__(self) -> str:
        levels = []
        if self.rules: levels.append(f"правил:{len(self.rules)}")
        if self.patterns: levels.append(f"закономерностей:{len(self.patterns)}")
        if self.trends: levels.append(f"тенденций:{len(self.trends)}")
        if self.mainstreams: levels.append(f"мейнстримов:{len(self.mainstreams)}")
        if self.fates: levels.append(f"судеб:{len(self.fates)}")
        if self.rock: levels.append(f"рок:{len(self.rock)}")

        return f"<BasicMode(user={self.user_id}, {', '.join(levels) if levels else 'начало'})>"
