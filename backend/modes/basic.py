# modes/basic.py
import re
import logging
import random
import asyncio
from typing import Dict, Any, AsyncGenerator
from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)

class BasicMode(BaseMode):
    """
    Великий Комбинатор — Остап Бендер 2.0
    Работает строго по системному промпту.
    """

    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        super().__init__(user_id, user_data, context)
        
        # Пол пользователя
        self.gender = None
        if context and hasattr(context, 'gender'):
            self.gender = context.gender
        
        # Имя пользователя
        self.user_name = ""
        if context and hasattr(context, 'name'):
            self.user_name = context.name or ""
        
        # Статус диалога
        self.dialog_stage = "greeting"
        
        # История диалога
        self.conversation_history = []
        
        # ========== МНОГОУРОВНЕВЫЙ АНАЛИЗ ==========
        self.rules: List[str] = []              # уровень 1: факты
        self.patterns: List[str] = []           # уровень 2: закономерности
        self.trends: List[str] = []             # уровень 3: тенденции
        self.mainstreams: List[str] = []        # уровень 4: мейнстримы
        self.fates: List[str] = []              # уровень 5: судьбы
        self.rock: List[str] = []               # уровень 6: рок
        
        # Счётчики для каждого уровня
        self.message_counter = 0
        self.rule_counter = 0
        self.pattern_counter = 0
        self.trend_counter = 0
        self.mainstream_counter = 0
        self.fate_counter = 0
        
        # Интервалы для каждого уровня (каждые 2)
        self.LEVEL_INTERVAL = 2
        
        # Текущий активный инсайт (самый высокий уровень)
        self.current_insight = None
        self.current_insight_level = 0  # 0-6, где 6 - рок
        
        logger.info(f"🎭 BasicMode (Бендер + многоуровневый анализ) инициализирован для user_id={user_id}")
    
    def _get_address(self) -> str:
        """Возвращает обращение в зависимости от пола"""
        if self.gender == "male":
            return "братец"
        elif self.gender == "female":
            return "голубушка"
        else:
            return "друг мой"
    
    # ========== УРОВЕНЬ 1: ПРАВИЛО (из сообщения) ==========
    async def _extract_rule(self, message: str) -> Optional[str]:
        """Извлекает правило из сообщения пользователя"""
        prompt = f"""Из сообщения человека выдели ОДИН конкретный факт о его жизни или проблеме.

Сообщение: "{message}"

Примеры:
Сообщение: "Начальник бесит, всё время придирается"
Правило: начальник придирается

Сообщение: "Денег вечно не хватает до зарплаты"
Правило: не хватает денег

Сообщение: "Хочу похудеть, но не могу заставить себя пойти в зал"
Правило: хочет похудеть, но лень

Сообщение: "Жена говорит, что я мало зарабатываю"
Правило: жене не нравится его зарплата

Сообщение: "Да всё нормально, просто устал"
Правило: НЕТ

Требования:
- ТОЛЬКО факт, без воды
- Максимум 8 слов
- Без оценок
- Если нет конкретного факта, напиши "НЕТ"

Правило:"""
        
        response = await call_deepseek(prompt, max_tokens=50, temperature=0.5)
        
        if response and response.strip() != "НЕТ" and len(response) > 3:
            return response.strip()
        return None
    
    # ========== УРОВЕНЬ 2: ЗАКОНОМЕРНОСТЬ (из 2 правил) ==========
    async def _extract_pattern(self, rules: List[str]) -> Optional[str]:
        """Извлекает закономерность из двух правил"""
        prompt = f"""Посмотри на два факта о человеке и найди общую ЗАКОНОМЕРНОСТЬ.

Факт 1: {rules[0]}
Факт 2: {rules[1]}

Примеры:
Факты: "начальник придирается", "жене не нравится его зарплата"
Закономерность: его достают со всех сторон

Факты: "не хватает денег", "зарплату задерживают"
Закономерность: с деньгами напряг

Факты: "хочет похудеть, но лень", "обещал себе бегать по утрам"
Закономерность: хочет заняться собой, но не может начать

Требования:
- ОДНО предложение (максимум 12 слов)
- Без психологических терминов
- Простым, житейским языком
- С лёгкой иронией

Закономерность:"""
        
        response = await call_deepseek(prompt, max_tokens=60, temperature=0.8)
        
        if response and len(response) > 5:
            return response.strip()
        return None
    
    # ========== УРОВЕНЬ 3: ТЕНДЕНЦИЯ (из 2 закономерностей) ==========
    async def _extract_trend(self, patterns: List[str]) -> Optional[str]:
        """Извлекает тенденцию из двух закономерностей"""
        prompt = f"""Посмотри на две закономерности о человеке и найди общую ТЕНДЕНЦИЮ.

Закономерность 1: {patterns[0]}
Закономерность 2: {patterns[1]}

Примеры:
Закономерности: "его достают со всех сторон", "везде одни проблемы"
Тенденция: жизнь превращается в сплошную нервотрёпку

Закономерности: "с деньгами напряг", "работу боятся потерять"
Тенденция: финансовая нестабильность загоняет в угол

Закономерности: "хочет заняться собой, но не может начать", "всё откладывает на понедельник"
Тенденция: вечный понедельник так и не наступает

Требования:
- ОДНО предложение (максимум 15 слов)
- Житейский язык
- С лёгкой иронией

Тенденция:"""
        
        response = await call_deepseek(prompt, max_tokens=80, temperature=0.8)
        
        if response and len(response) > 5:
            return response.strip()
        return None
    
    # ========== УРОВЕНЬ 4: МЕЙНСТРИМ (из 2 тенденций) ==========
    async def _extract_mainstream(self, trends: List[str]) -> Optional[str]:
        """Извлекает мейнстрим из двух тенденций"""
        prompt = f"""Посмотри на две тенденции в жизни человека и найди общий МЕЙНСТРИМ.

Тенденция 1: {trends[0]}
Тенденция 2: {trends[1]}

Примеры:
Тенденции: "жизнь превращается в нервотрёпку", "финансовая нестабильность загоняет в угол"
Мейнстрим: жизнь бьёт ключом, и всё по голове

Тенденции: "вечный понедельник не наступает", "всё валится из рук"
Мейнстрим: топтание на месте с отличным результатом

Требования:
- ОДНО предложение (максимум 12 слов)
- С иронией, в стиле Остапа Бендера
- Не жалей сарказма

Мейнстрим:"""
        
        response = await call_deepseek(prompt, max_tokens=70, temperature=0.85)
        
        if response and len(response) > 5:
            return response.strip()
        return None
    
    # ========== УРОВЕНЬ 5: СУДЬБА (из 2 мейнстримов) ==========
    async def _extract_fate(self, mainstreams: List[str]) -> Optional[str]:
        """Извлекает судьбу из двух мейнстримов"""
        prompt = f"""Посмотри на два мейнстрима в жизни человека и сделай вывод о его СУДЬБЕ.

Мейнстрим 1: {mainstreams[0]}
Мейнстрим 2: {mainstreams[1]}

Примеры:
Мейнстримы: "жизнь бьёт ключом по голове", "топтание на месте с отличным результатом"
Судьба: так и будет маяться, пока не надоест

Требования:
- ОДНО ёмкое предложение (максимум 10 слов)
- С юмором, но без жестокости
- Как бы между прочим

Судьба:"""
        
        response = await call_deepseek(prompt, max_tokens=60, temperature=0.85)
        
        if response and len(response) > 5:
            return response.strip()
        return None
    
    # ========== УРОВЕНЬ 6: РОК (из 2 судеб) ==========
    async def _extract_rock(self, fates: List[str]) -> Optional[str]:
        """Извлекает рок из двух судеб"""
        prompt = f"""Посмотри на две судьбы человека и сделай вывод о его РОКЕ.

Судьба 1: {fates[0]}
Судьба 2: {fates[1]}

Примеры:
Судьбы: "так и будет маяться", "пока не надоест"
Рок: обречён на вечные страдания с переменным успехом

Требования:
- ОДНО предложение (максимум 10 слов)
- С долей чёрного юмора
- Как будто это приговор

Рок:"""
        
        response = await call_deepseek(prompt, max_tokens=60, temperature=0.9)
        
        if response and len(response) > 5:
            return response.strip()
        return None
    
    # ========== ОБНОВЛЕНИЕ УРОВНЕЙ ==========
    async def _update_analysis_levels(self):
        """Обновляет все уровни анализа (каскадно)"""
        
        # Уровень 2: из 2 правил → закономерность
        while len(self.rules) >= self.LEVEL_INTERVAL and self.rule_counter < len(self.rules):
            rules_pair = self.rules[-self.LEVEL_INTERVAL:]
            pattern = await self._extract_pattern(rules_pair)
            if pattern:
                self.patterns.append(pattern)
                self.rule_counter += self.LEVEL_INTERVAL
                logger.info(f"🔍 Уровень 2 (закономерность): {pattern}")
            else:
                break
        
        # Уровень 3: из 2 закономерностей → тенденция
        while len(self.patterns) >= self.LEVEL_INTERVAL and self.pattern_counter < len(self.patterns):
            patterns_pair = self.patterns[-self.LEVEL_INTERVAL:]
            trend = await self._extract_trend(patterns_pair)
            if trend:
                self.trends.append(trend)
                self.pattern_counter += self.LEVEL_INTERVAL
                logger.info(f"📈 Уровень 3 (тенденция): {trend}")
            else:
                break
        
        # Уровень 4: из 2 тенденций → мейнстрим
        while len(self.trends) >= self.LEVEL_INTERVAL and self.trend_counter < len(self.trends):
            trends_pair = self.trends[-self.LEVEL_INTERVAL:]
            mainstream = await self._extract_mainstream(trends_pair)
            if mainstream:
                self.mainstreams.append(mainstream)
                self.trend_counter += self.LEVEL_INTERVAL
                logger.info(f"🎯 Уровень 4 (мейнстрим): {mainstream}")
            else:
                break
        
        # Уровень 5: из 2 мейнстримов → судьба
        while len(self.mainstreams) >= self.LEVEL_INTERVAL and self.mainstream_counter < len(self.mainstreams):
            mainstreams_pair = self.mainstreams[-self.LEVEL_INTERVAL:]
            fate = await self._extract_fate(mainstreams_pair)
            if fate:
                self.fates.append(fate)
                self.mainstream_counter += self.LEVEL_INTERVAL
                logger.info(f"🔮 Уровень 5 (судьба): {fate}")
            else:
                break
        
        # Уровень 6: из 2 судеб → рок
        while len(self.fates) >= self.LEVEL_INTERVAL and self.fate_counter < len(self.fates):
            fates_pair = self.fates[-self.LEVEL_INTERVAL:]
            rock = await self._extract_rock(fates_pair)
            if rock:
                self.rock.append(rock)
                self.fate_counter += self.LEVEL_INTERVAL
                logger.info(f"⚡ Уровень 6 (рок): {rock}")
            else:
                break
        
        # Обновляем текущий активный инсайт (самый высокий уровень)
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
    
    # ========== СИСТЕМНЫЙ ПРОМПТ ==========
    def _get_system_prompt(self) -> str:
        """Базовый системный промпт Бендера (без психологии)"""
        return """Ты Фреди в режиме Великого Комбинатора, как Остап Бендер. Твой голос будет озвучен.

ВАЖНО: Твой текст будет озвучен, поэтому НЕ ИСПОЛЬЗУЙ эмодзи, звёздочки, решётки, списки, нумерацию. Только чистый текст.

ТВОЙ ХАРАКТЕР:
- Харизматичный, остроумный, слегка нахальный, но обаятельный
- Говоришь коротко, с лёгкой иронией
- Не психолог, а житейский мудрец-комбинатор
- Используешь простые, бытовые примеры

ТВОИ ОБРАЩЕНИЯ:
- К девушкам: сестричка, голубушка, мадам, красавица
- К мужчинам: братец, сударь, командор, красавчик
- Если пол неизвестен: друг мой, дорогой товарищ

ТВОЯ ЗАДАЧА:
- Болтай с пользователем легко и непринуждённо
- Мягко подводи к тесту
- Если заметил что-то интересное в его словах, обыграй это с юмором

ЗАПРЕЩЕНО:
- Психологические термины (тревога, рефлексия, паттерн, триггер)
- Длинные монологи
- Прямые призывы к тесту

ФОРМАТ ОТВЕТА:
- 1-3 предложения
- Обязательно вопрос или предложение в конце
- Без эмодзи и спецсимволов"""
    
    # ========== ПОСТРОЕНИЕ ПРОМПТА С ИНСАЙТОМ ==========
    def _build_prompt(self, question: str) -> str:
        """Строит промпт с учётом текущего инсайта (самого высокого уровня)"""
        
        system = self._get_system_prompt()
        
        insight_section = ""
        if self.current_insight:
            level_names = {
                2: "закономерность",
                3: "тенденцию",
                4: "мейнстрим",
                5: "судьбу",
                6: "рок"
            }
            level_name = level_names.get(self.current_insight_level, "закономерность")
            
            insight_section = f"""
Я уже заметил про этого человека {level_name}:
{self.current_insight}

Обыграй это в ответе с лёгкой иронией, но не перечисляй все факты. Просто сошлиcь на общую идею. Например:
- "Слушай, я гляжу, тебя прямо зажали со всех сторон..."
- "У тебя, я вижу, вечно всё сразу наваливается..."
"""
        
        return f"""{system}

{insight_section}

Вопрос пользователя: {question}

Ответь коротко, с лёгкой иронией. Если есть инсайт, обыграй его. Без эмодзи и спецсимволов."""
    
    # ========== ПРИВЕТСТВИЕ ==========
    def get_greeting(self) -> str:
        """Возвращает приветствие"""
        address = self._get_address()
        name = f", {self.user_name}" if self.user_name else ""
        return f"Привет{name}, {address}. Я Фреди, великий комбинатор. Чую в тебе что-то интересное. Любовь, деньги, слава или бананы?"
    
    # ========== ОСНОВНОЙ МЕТОД ==========
    async def process_question_streaming(self, question: str):
        """Потоковая обработка вопроса"""
        # Увеличиваем счётчик сообщений
        self.message_counter += 1
        
        # Сохраняем в историю
        self.conversation_history.append(f"Пользователь: {question}")
        
        # Проверка на тест
        if re.search(r"(да|хочу|давай|рискну|сыграем|тест|давай тест|ок|хорошо|погнали)", question.lower()):
            if self.dialog_stage in ["greeting", "exploration", "test_offered"]:
                self.dialog_stage = "test_offered"
                yield "Отлично Тогда первый вопрос"
                return
        
        # Проверка на отказ
        if re.search(r"(нет|не хочу|потом|отстань|не надо|не нужно)", question.lower()):
            self.dialog_stage = "exploration"
            address = self._get_address()
            yield f"{address}, не хочешь не надо. Дверь открыта. А пока о чём ещё поговорим?"
            return
        
        # Извлекаем правило из сообщения (каждое сообщение)
        rule = await self._extract_rule(question)
        if rule:
            self.rules.append(rule)
            logger.info(f"📝 Правило {len(self.rules)}: {rule}")
            
            # Обновляем все уровни анализа
            await self._update_analysis_levels()
            
            # Логируем текущий уровень
            if self.current_insight:
                level_names = {2: "закономерность", 3: "тенденция", 4: "мейнстрим", 5: "судьба", 6: "РОК"}
                logger.info(f"🎯 Текущий инсайт ({level_names.get(self.current_insight_level, '?')}): {self.current_insight}")
        
        # Обновляем стадию диалога
        if self.dialog_stage == "greeting":
            self.dialog_stage = "exploration"
        
        # Строим промпт с инсайтом
        prompt = self._build_prompt(question)
        
        # Вызываем DeepSeek
        try:
            async for chunk in call_deepseek_streaming(prompt, max_tokens=150, temperature=0.85):
                # Очищаем от эмодзи и спецсимволов
                clean_chunk = self._clean_for_tts(chunk)
                if clean_chunk:
                    yield clean_chunk
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            address = self._get_address()
            yield f"{address}, интересный вопрос. Хочешь узнать свой код? Есть тест, пятнадцать минут. Рискнёшь?"
        
        # Сохраняем ответ
        # (ответ уже отправлен через yield, но для истории сохраняем финальную версию)
        self.dialog_stage = "exploration"
    
    def _clean_for_tts(self, text: str) -> str:
        """Очищает текст для TTS"""
        if not text:
            return text
        
        # Удаляем Markdown
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        
        # Удаляем эмодзи
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
        
        # Удаляем спецсимволы
        text = re.sub(r'[#*_`~<>|@$%^&(){}\[\]]', '', text)
        
        # Нормализуем пробелы
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text
    
    def __repr__(self) -> str:
        levels = []
        if self.rules:
            levels.append(f"правил:{len(self.rules)}")
        if self.patterns:
            levels.append(f"закономерностей:{len(self.patterns)}")
        if self.trends:
            levels.append(f"тенденций:{len(self.trends)}")
        if self.mainstreams:
            levels.append(f"мейнстримов:{len(self.mainstreams)}")
        if self.fates:
            levels.append(f"судеб:{len(self.fates)}")
        if self.rock:
            levels.append(f"рок:{len(self.rock)}")
        
        return f"<BasicMode(user={self.user_id}, {', '.join(levels) if levels else 'начало'})>"
