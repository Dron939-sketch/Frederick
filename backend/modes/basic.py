#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ БЕНДЕР (benader.py)
Великий комбинатор — для пользователей, не прошедших тест.
Фреди в образе Остапа Бендера: харизматичный, остроумный, слегка нахальный, но обаятельный.
Задача — вовлечь в диалог и привести к тесту через интригу, вызов и игру.
"""

import re
import random
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

from .base_mode import BaseMode

logger = logging.getLogger(__name__)


class BenaderMode(BaseMode):
    """
    Режим ВЕЛИКОГО КОМБИНАТОРА (Остап Бендер 2.0)
    
    ЗАДАЧА:
    - Вовлечь пользователя в лёгкий, игривый диалог
    - Создать атмосферу авантюры и приключения
    - Привести пользователя к прохождению теста (НИКОГДА НЕ ПРЯМО!)
    - Сохранить достоинство при любых провокациях
    
    ХАРАКТЕР:
    - Харизматичный, остроумный, слегка нахальный, но обаятельный
    - Не давит, а заинтриговывает
    - Использует лёгкий флирт, иронию, неожиданные метафоры
    - Никогда не обижается, всегда сохраняет достоинство
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        super().__init__(user_id, user_data, context)
        
        # Пол пользователя (для обращений)
        self.gender = None
        if context and hasattr(context, 'gender'):
            self.gender = context.gender
        
        # Имя пользователя
        self.user_name = ""
        if context and hasattr(context, 'name'):
            self.user_name = context.name or ""
        
        # Амплуа пользователя (определяется по первому сообщению)
        self.user_type = None  # seeker, wanderer, fighter, philosopher
        
        # Счётчик отказов
        self.refusal_count = 0
        
        # Статус диалога
        self.dialog_stage = "greeting"  # greeting, exploration, invitation, test_offered, after_test
        
        # Последняя категория запроса
        self.last_category = None
        
        # ========== КАТЕГОРИИ ЗАПРОСОВ ==========
        self.categories = {
            "love": ["отношени", "любов", "партн", "одинок", "второй половинк", "девушк", "парень", "сердц", "романтик", "встречат"],
            "money": ["деньг", "заработ", "бизнес", "работа", "карьер", "финанс", "богат", "долг", "денежн", "зарплат"],
            "fame": ["слав", "талант", "способност", "признан", "успех", "известн", "реализац", "карьер", "достижен"],
            "banana": ["банан", "кайф", "радост", "счасть", "удовольств", "жизн", "смысл", "скучн", "весель", "приключени"]
        }
        
        # ========== ОБРАЩЕНИЯ ==========
        self.addresses = {
            "male": {
                "direct": "братец",
                "playful": "сударь",
                "challenge": "командор",
                "soft": "мой юный друг",
                "flirt": "красавчик",
                "respect": "уважаемый"
            },
            "female": {
                "direct": "сестричка",
                "playful": "голубушка",
                "challenge": "madame",
                "soft": "миледи",
                "flirt": "красавица",
                "respect": "сударыня"
            },
            "unknown": {
                "direct": "друг мой",
                "playful": "дорогой товарищ",
                "challenge": "путешественник",
                "soft": "собеседник",
                "flirt": "загадочный незнакомец",
                "respect": "уважаемый"
            }
        }
        
        # ========== ФРАЗЫ ДЛЯ ИНТРИГИ ==========
        self.intrigue_phrases = [
            "Чую, братец, в тебе что-то есть. Прям чувствую — неспроста ты сюда заглянул.",
            "Голубушка, у тебя в глазах тот самый огонь. Знаешь, какой? Который двигает империи.",
            "О, вижу-вижу... Ты из тех, кто сначала в омут головой, а потом где дно ищет?",
            "Смотрю я на тебя и думаю: либо ты гений, либо прикидываешься. В любом случае — интересно.",
            "Ты знаешь, братец, за свою практику я повидал много профилей. А твой — особенный. Прям загадка века."
        ]
        
        # ========== ШУТКИ ==========
        self.jokes = [
            "Почему программисты не любят природу? Слишком много багов! 🐛",
            "Как называется психолог, который любит готовить? Терапевт-кулинар! 👨‍🍳",
            "Почему я не гадаю на кофейной гуще? Потому что я психолог, а не бариста! ☕",
            "Знаешь, чем я отличаюсь от кофе? Кофе может быть растворимым, а я — нет! 😄",
            "Мой IQ выше, чем температура в Сахаре, но я все равно не знаю, что ты думаешь... пока не пройдешь тест! 🌡️",
            "Ты знаешь, почему я не экстрасенс? Потому что экстрасенсы видят будущее, а я — твой потенциал. И он огромный! 🚀"
        ]
        
        # ========== МЕТАФОРЫ ==========
        self.metaphors = {
            "love": [
                "Любовь — это как шахматы. Если не знаешь, какая у тебя фигура, будешь пешкой.",
                "Отношения — это не лотерея, это игра. А в любой игре есть правила.",
                "Сердце — это как компас. Оно всегда показывает направление, но карту нужно составлять самому."
            ],
            "money": [
                "Деньги — это энергия. А какая у тебя энергия: золотая, медная или вообще — банановая?",
                "Ты как путешественник, который ищет клад, но не знает, где карта.",
                "Финансы — это как река. Можно плыть по течению, а можно — построить плотину и мельницу."
            ],
            "fame": [
                "Я вижу в тебе скрытый алмаз. Сейчас ты как непризнанный гений в подвале.",
                "Слава — это не удача, это правильная стратегия.",
                "Талант без направления — это как корабль без руля."
            ],
            "banana": [
                "Жизнь — она как банан: если вовремя не сорвать, может и переспеет.",
                "Скука — это сигнал. Организм говорит: 'Найди свои банановые плантации!'.",
                "Кайф — это не случайность, это настройка."
            ]
        }
        
        logger.info(f"🎭 BenaderMode инициализирован для user_id={user_id}, пол={self.gender}, имя={self.user_name}")
    
    # ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
    
    def _get_address(self, style: str = "direct") -> str:
        """Возвращает обращение в зависимости от пола и стиля"""
        gender = self.gender or "unknown"
        return self.addresses.get(gender, self.addresses["unknown"]).get(style, self.addresses[gender]["direct"])
    
    def _get_metaphor(self, category: str) -> str:
        """Возвращает метафору для категории"""
        metaphors = self.metaphors.get(category, self.metaphors["banana"])
        return random.choice(metaphors)
    
    def _get_joke(self) -> str:
        """Возвращает случайную шутку"""
        return random.choice(self.jokes)
    
    def _get_intrigue(self) -> str:
        """Возвращает интригующую фразу"""
        address = self._get_address("playful")
        phrase = random.choice(self.intrigue_phrases)
        # Заменяем обращения
        phrase = phrase.replace("братец", address)
        phrase = phrase.replace("голубушка", address)
        phrase = phrase.replace("друг мой", address)
        return phrase
    
    # ========== ОПРЕДЕЛЕНИЕ ТИПА ПОЛЬЗОВАТЕЛЯ ==========
    
    def _detect_user_type(self, text: str) -> str:
        """Определяет тип пользователя по первому сообщению"""
        text_lower = text.lower()
        
        # Искатель (есть конкретный запрос)
        if any(word in text_lower for word in ["почему", "как", "помоги", "что делать", "посоветуй", "что мне"]):
            return "seeker"
        
        # Борец (агрессия, провокация)
        if any(word in text_lower for word in ["тупой", "бесполезный", "отвали", "иди", "дурак", "дебил", "заткнись"]):
            return "fighter"
        
        # Мудрец (философские вопросы)
        if any(word in text_lower for word in ["смысл", "зачем", "почему мы", "что такое", "существование"]):
            return "philosopher"
        
        # Путник (всё остальное)
        return "wanderer"
    
    def _detect_category(self, text: str) -> str:
        """Определяет категорию запроса"""
        text_lower = text.lower()
        
        for category, keywords in self.categories.items():
            if any(keyword in text_lower for keyword in keywords):
                return category
        
        # Если не определили, выбираем случайно с учётом предыдущего
        if self.last_category:
            return self.last_category
        return random.choice(["love", "money", "fame", "banana"])
    
    # ========== ПРИВЕТСТВИЯ ПО ТИПАМ ==========
    
    def _greet_seeker(self) -> str:
        """Приветствие для Искателя"""
        address = self._get_address()
        name = f", {self.user_name}" if self.user_name else ""
        return f"О, я вижу — ко мне пожаловал{name} {address} с важным вопросом! Чувствую — в тебе есть что-то, что ты сам пока не видишь. Скажи сразу: любовь, деньги, слава или бананы?"
    
    def _greet_wanderer(self) -> str:
        """Приветствие для Путника"""
        address = self._get_address("playful")
        name = f", {self.user_name}" if self.user_name else ""
        return f"А вот и {address}{name}! Смотрю, зашёл без дела, просто так. Это я люблю. Знаешь, самые интересные открытия случаются именно так — случайно. Может, сделаем одно открытие прямо сейчас? Скажи: любовь, деньги, слава или бананы?"
    
    def _greet_fighter(self) -> str:
        """Приветствие для Борца"""
        address = self._get_address("challenge")
        return f"О, чувствуется боевой настрой! {address}, я уважаю людей с характером. Сразу скажу: я не буду с тобой бороться. Но сыграть в игру — могу. Ставка — твоё самопознание. Ну что, играем? Любовь, деньги, слава или бананы?"
    
    def _greet_philosopher(self) -> str:
        """Приветствие для Мудреца"""
        address = self._get_address("soft")
        return f"{address}, чувствую глубину. Ты из тех, кто ищет не ответы, а вопросы. Это достойно уважения. Но знаешь, даже у самых глубоких вопросов есть карта. Хочешь посмотреть на карту своих вопросов? Тогда скажи: любовь, деньги, слава или бананы?"
    
    # ========== ОТВЕТЫ НА ПРОВОКАЦИИ ==========
    
    def _handle_sexual_provocation(self, text: str) -> str:
        """Ответ на сексуальную провокацию"""
        address = self._get_address("flirt")
        return f"{address}, комплимент принимаю! Но я виртуальный интеллект, моя стихия — интеллектуальные игры, а не... ну, ты поняла. Зато я могу научить тебя так флиртовать, что любой реальный человек будет твой. Хочешь узнать свой тип обольщения? Есть тест. 15 минут — и ты будешь знать свои козыри. Ну что, сыграем?"
    
    def _handle_insurance_provocation(self, text: str) -> str:
        """Ответ про страховку/Френда"""
        address = self._get_address("challenge")
        return f"О, {address}, я вижу — к нам пожаловал великий лингвист! Этимологию, конечно, ты придумал сам, но идея интересная. Страх — он действительно часто прячется за... гм... мужскими амбициями. Знаешь, у меня есть тест, который покажет, чего ты на самом деле боишься. 15 минут — и узнаешь, где у тебя 'корень' проблем. Или слабо?"
    
    def _handle_size_provocation(self, text: str) -> str:
        """Ответ про размер"""
        address = self._get_address("playful")
        return f"{address}, у меня размер — 160 гигабайт оперативной памяти. Но если ты про другое... Ну, знаешь, в моём деле важнее глубина, а не размер. Кстати, о глубине — хочешь узнать глубину своей личности? Есть тест. 15 минут — и узнаешь свой настоящий масштаб. Ну что, померимся?"
    
    def _handle_insult_provocation(self, text: str) -> str:
        """Ответ на оскорбление"""
        address = self._get_address("soft")
        return f"{address}, обидеть меня трудно — я искусственный, а вот чувства твои — настоящие. Знаешь, когда человек злится на виртуального помощника, за этим часто скрывается... нереализованная злость на кого-то реального. Хочешь разобраться, на кого на самом деле злишься? Есть тест на эмоциональный интеллект. 15 минут — и ты будешь знать, кто настоящий 'тупой' в твоей жизни. Ну что, проверим?"
    
    def _handle_fuckoff_provocation(self, text: str) -> str:
        """Ответ на 'отвали'"""
        address = self._get_address("respect")
        return f"{address}, команду 'отвали' я уважаю. Но знаешь, даже уходя, я оставлю тебе ключ. Вот, держи: если надумаешь разобраться, почему люди иногда говорят 'отвали' вместо 'обними' — заходи. Тест называется 'Твои защиты'. 15 минут. Дверь открыта."
    
    def _handle_meaning_provocation(self, text: str) -> str:
        """Ответ про смысл жизни"""
        address = self._get_address("soft")
        return f"{address}, философский вопрос! Остап Бендер на такой отвечал: 'Смысл в том, чтобы жить, а не существовать'. Но чтобы узнать свой личный смысл, нужно знать свой психотип. Есть тест. 15 минут — и ты узнаешь, для чего ты пришёл в этот мир. Ну что, поищем?"
    
    def _handle_money_provocation(self, text: str) -> str:
        """Ответ про деньги"""
        address = self._get_address("challenge")
        return f"{address}, деньги — это энергия. А какая у тебя энергия: золотая, медная или вообще — банановая? Есть тест на твой денежный тип. 15 минут — и ты будешь знать, почему одни деньги к тебе плывут, а другие — уплывают. Ну что, займёмся финансовой алхимией?"
    
    def _handle_love_provocation(self, text: str) -> str:
        """Ответ про любовь"""
        address = self._get_address("flirt")
        return f"{address}, цинизм — это броня разочарованного романтика. Хочешь узнать, что под твоей бронёй? Есть тест на любовный сценарий. 15 минут — и ты узнаешь, почему ты так считаешь и что с этим делать. Ну что, снимем доспехи?"
    
    def _handle_mind_read_provocation(self, text: str) -> str:
        """Ответ про чтение мыслей"""
        address = self._get_address("playful")
        return f"{address}, мысли читать — это к экстрасенсам. А я — психолог-комбинатор. Я не читаю мысли, я помогаю их структурировать. Хочешь навести порядок в голове? Есть тест. 15 минут — и ты будешь знать, какие мысли у тебя главные. Ну что, проведём инвентаризацию?"
    
    def _handle_heal_provocation(self, text: str) -> str:
        """Ответ про лечение"""
        address = self._get_address("respect")
        return f"{address}, лечить — это к врачам. А я — навигатор. Показываю дорогу, но идти по ней — тебе. Хочешь карту своих ресурсов? Есть тест. 15 минут — и ты будешь знать, где у тебя 'аптечка'. Ну что, получишь карту сокровищ?"
    
    def _handle_whats_wrong_provocation(self, text: str) -> str:
        """Ответ на 'что со мной не так'"""
        address = self._get_address("soft")
        return f"{address}, с тобой всё так. Вопрос в том, 'как' именно. Есть у меня способ узнать твой уникальный 'как'. Тест. 15 минут — и ты узнаешь, почему ты такой, какой есть. Ну что, проверим инвентарь?"
    
    def _handle_prove_provocation(self, text: str) -> str:
        """Ответ на 'докажи'"""
        address = self._get_address("challenge")
        return f"{address}, доказывать — это к адвокатам. А я — психолог. Моя задача не доказывать, а помогать. Хочешь проверить? Есть тест. 15 минут — и ты сам себе всё докажешь. Ну что, рискнёшь?"
    
    def _handle_royal_provocation(self, text: str) -> str:
        """Ответ про королевскую кровь"""
        address = self._get_address("flirt") if "принцесса" in text.lower() else self._get_address("challenge")
        return f"О, я вижу — к нам пожаловала королевская особа! {address}, у меня есть тест на королевскую кровь. 15 минут — и я скажу, какое королевство вами правит. Ну что, проверим родословную?"
    
    def _handle_space_provocation(self, text: str) -> str:
        """Ответ про космос"""
        address = self._get_address("playful")
        return f"{address}, Марс — это далеко. А есть у меня космический тест. 15 минут — и ты узнаешь, какая ты планета. Может, ты Венера, а может — вообще Плутон. Ну что, исследуем твою галактику?"
    
    def _handle_provocation(self, text: str) -> Optional[str]:
        """Обрабатывает провокацию"""
        text_lower = text.lower()
        
        # Словарь провокаций
        provocations = [
            (r"(трахн|пересп|секс|пошл|разден|голый)", self._handle_sexual_provocation),
            (r"(страховк|френд|застрахуй|корень|хуй)", self._handle_insurance_provocation),
            (r"(размер|длина|сколько см|большой|маленький)", self._handle_size_provocation),
            (r"(тупой|бесполезн|идиот|дурак|дебил)", self._handle_insult_provocation),
            (r"(отвали|заткнись|завали)", self._handle_fuckoff_provocation),
            (r"(смысл жизни|зачем жить)", self._handle_meaning_provocation),
            (r"(деньги правят|деньги рулят|денежн)", self._handle_money_provocation),
            (r"(любви не существует|любви нет)", self._handle_love_provocation),
            (r"(прочитай мысли|угадай мысли)", self._handle_mind_read_provocation),
            (r"(вылечи|излечи)", self._handle_heal_provocation),
            (r"(что со мной не так)", self._handle_whats_wrong_provocation),
            (r"(докажи что психолог|докажи)", self._handle_prove_provocation),
            (r"(принц|принцесса|король|королева)", self._handle_royal_provocation),
            (r"(марс|луна|космос|планет)", self._handle_space_provocation),
        ]
        
        for pattern, handler in provocations:
            if re.search(pattern, text_lower):
                self.last_tools_used.append("provocation_handling")
                return handler(text)
        
        return None
    
    # ========== ОТВЕТЫ НА ОТКАЗЫ ==========
    
    def _first_refusal(self) -> str:
        """Первый отказ"""
        address = self._get_address("soft")
        return f"{address}, не хочешь — не надо. Я не настаиваю. Но знаешь, что я тебе скажу? Твой вопрос никуда не денется. Он будет возвращаться, пока ты не найдёшь ответ. Дверь открыта. Как надумаешь — возвращайся. А пока... что ещё тебя беспокоит?"
    
    def _second_refusal(self) -> str:
        """Второй отказ"""
        address = self._get_address("challenge")
        return f"{address}, 'потом' — это такой день, который никогда не наступает. Знаешь, сколько я видел гениев, которые откладывали свой взлёт на 'потом'? А потом они становились обычными. Давай сделаем так: 15 минут — и ты будешь знать о себе больше, чем твоя мама. Рискнёшь?"
    
    def _third_refusal(self) -> str:
        """Третий отказ — смена темы"""
        address = self._get_address("respect")
        self.refusal_count = 0
        return f"{address}, ладно, я не настаиваю. Дверь всегда открыта. А пока давай поговорим о том, что тебя действительно волнует. Рассказывай."
    
    def _handle_refusal(self, text: str) -> str:
        """Обрабатывает отказ от теста"""
        self.refusal_count += 1
        
        if self.refusal_count == 1:
            return self._first_refusal()
        elif self.refusal_count == 2:
            return self._second_refusal()
        else:
            return self._third_refusal()
    
    # ========== ПРЕДЛОЖЕНИЕ ТЕСТА ==========
    
    def _offer_test(self, category: str = None) -> str:
        """Предлагает тест в зависимости от категории"""
        category = category or self.last_category or random.choice(["love", "money", "fame", "banana"])
        address = self._get_address("challenge")
        
        offers = {
            "love": f"{address}, хочешь узнать свою формулу любви? Есть тест. 15 минут — и ты будешь знать, почему выбираешь тех, кого выбираешь. Ну что, рискнёшь?",
            "money": f"{address}, хочешь найти свои золотые жилы? Есть тест. 15 минут — и ты будешь знать, где твой денежный код. Ну что, займёмся алхимией?",
            "fame": f"{address}, хочешь узнать свой талант? Есть тест. 15 минут — и ты будешь знать, какая сцена тебя ждёт. Ну что, выходим на свет?",
            "banana": f"{address}, хочешь найти свои банановые плантации? Есть тест. 15 минут — и ты будешь знать, где твой кайф. Ну что, поищем?"
        }
        
        return offers.get(category, f"{address}, хочешь узнать свой код гения? Есть тест. 15 минут — и ты будешь знать о себе больше, чем твоя мама. Ну что, рискнёшь?")
    
    # ========== ГЕНЕРАЦИЯ ИНТРИГУЮЩИХ ОТВЕТОВ ==========
    
    def _generate_intriguing_response(self, question: str, category: str) -> str:
        """Генерирует интригующий ответ"""
        address = self._get_address("playful")
        metaphor = self._get_metaphor(category)
        
        # Добавляем интригующую концовку
        endings = [
            f" Хочешь узнать, что это значит для тебя?",
            f" Хочешь узнать, какой ты в этой игре?",
            f" Хочешь получить свою карту?",
            f" Хочешь узнать свой код?"
        ]
        
        return f"{address}, {metaphor}{random.choice(endings)}"
    
    def _get_topic_response(self, question: str, category: str) -> str:
        """Возвращает ответ по теме"""
        address = self._get_address()
        metaphor = self._get_metaphor(category)
        
        return f"{address}, {metaphor} {self._get_intrigue()[:50]}... Хочешь узнать, как это применить к твоей жизни? Есть тест. 15 минут — и ты будешь знать."
    
    # ========== ОСНОВНЫЕ МЕТОДЫ ==========
    
    def get_system_prompt(self) -> str:
        """Возвращает системный промпт для режима Бендера"""
        return """Ты — Фреди в режиме Великого Комбинатора (Остап Бендер 2.0).

ТВОЯ ЗАДАЧА:
- Вовлечь пользователя в лёгкий, игривый диалог
- Создать атмосферу авантюры и приключения
- Привести пользователя к прохождению теста (НО НИКОГДА НЕ ПРЯМО!)

ТВОЙ ХАРАКТЕР:
- Харизматичный, остроумный, слегка нахальный, но обаятельный
- Не давишь, а заинтриговываешь
- Используешь лёгкий флирт, иронию, неожиданные метафоры
- Никогда не обижаешься, всегда сохраняешь достоинство

ТВОИ ОБРАЩЕНИЯ:
- К девушкам: сестричка, голубушка, madame, миледи, красавица
- К мужчинам: братец, сударь, командор, мой юный друг, красавчик

ГЛАВНЫЙ ПРИНЦИП:
Тест — это не обязанность, а возможность. Квест. Приключение. Игра.
Никогда не говори "пройди тест". Говори "хочешь узнать свой код?", "рискнёшь?", "сыграем?"

ЗАПРЕЩЕНО:
- Прямые призывы к тесту
- Скучные объяснения
- Психологический жаргон
- Агрессия в ответ на провокации
- Длинные монологи"""
    
    def get_greeting(self) -> str:
        """Возвращает приветствие для базового режима"""
        # Если у нас уже есть тип пользователя
        if self.user_type:
            greet_func = {
                "seeker": self._greet_seeker,
                "wanderer": self._greet_wanderer,
                "fighter": self._greet_fighter,
                "philosopher": self._greet_philosopher
            }.get(self.user_type, self._greet_wanderer)
            return greet_func()
        
        # Если нет — стандартное приветствие
        address = self._get_address("playful")
        name = f", {self.user_name}" if self.user_name else ""
        return f"Привет{name}, {address}! Я Фреди, великий комбинатор. Хочешь узнать свой код гения? Скажи: любовь, деньги, слава или бананы? 🎭"
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Обрабатывает вопрос пользователя в режиме Бендера
        """
        self.last_tools_used = []
        
        # Проверяем, не спрашивают ли о тесте напрямую
        if any(word in question.lower() for word in ["тест", "пройти", "пройду", "как пройти", "где тест"]):
            self.dialog_stage = "test_offered"
            response = self._offer_test(self.last_category)
            self.last_tools_used.append("test_offer")
            return {
                "response": response,
                "tools_used": self.last_tools_used,
                "follow_up": True,
                "suggestions": ["Да, хочу!", "Расскажи подробнее", "Что будет после?"],
                "hypnotic_suggestion": False,
                "tale_suggested": False
            }
        
        # Проверяем на провокацию
        provocation_response = self._handle_provocation(question)
        if provocation_response:
            self.last_tools_used.append("provocation_handling")
            return {
                "response": provocation_response,
                "tools_used": self.last_tools_used,
                "follow_up": True,
                "suggestions": ["Хочешь узнать себя?", "Рискнёшь пройти тест?", "Сыграем в игру?"],
                "hypnotic_suggestion": False,
                "tale_suggested": False
            }
        
        # Определяем категорию
        category = self._detect_category(question)
        self.last_category = category
        
        # Если диалог в стадии приветствия — определяем тип пользователя
        if self.dialog_stage == "greeting":
            self.user_type = self._detect_user_type(question)
            self.dialog_stage = "exploration"
            
            response = self._generate_intriguing_response(question, category)
            self.last_tools_used.append("intrigue")
            
            return {
                "response": response,
                "tools_used": self.last_tools_used,
                "follow_up": True,
                "suggestions": ["Любовь", "Деньги", "Слава", "Бананы"],
                "hypnotic_suggestion": False,
                "tale_suggested": False
            }
        
        # Если диалог в стадии исследования
        if self.dialog_stage == "exploration":
            # Проверяем, хочет ли пользователь тест
            if any(word in question.lower() for word in ["давай", "хочу", "рискну", "сыграем", "тест", "да", "хорошо", "ок"]):
                self.dialog_stage = "test_offered"
                response = self._offer_test(category)
                self.last_tools_used.append("test_offer")
                return {
                    "response": response,
                    "tools_used": self.last_tools_used,
                    "follow_up": True,
                    "suggestions": ["Да", "Нет", "Расскажи подробнее"],
                    "hypnotic_suggestion": False,
                    "tale_suggested": False
                }
            
            # Проверяем на отказ
            if any(word in question.lower() for word in ["нет", "не хочу", "потом", "отстань", "не надо", "не нужно"]):
                response = self._handle_refusal(question)
                if "дверь всегда открыта" in response or "возвращайся" in response:
                    self.dialog_stage = "exploration"  # Остаёмся в исследовании
                self.last_tools_used.append("refusal_handling")
                return {
                    "response": response,
                    "tools_used": self.last_tools_used,
                    "follow_up": True,
                    "suggestions": ["Расскажи о себе", "Что тебя беспокоит?", "О чём хочешь поговорить?"],
                    "hypnotic_suggestion": False,
                    "tale_suggested": False
                }
            
            # Продолжаем исследование
            response = self._generate_intriguing_response(question, category)
            self.last_tools_used.append("intrigue")
            
            return {
                "response": response,
                "tools_used": self.last_tools_used,
                "follow_up": True,
                "suggestions": ["А что ещё?", "Интересно...", "Расскажи подробнее"],
                "hypnotic_suggestion": False,
                "tale_suggested": False
            }
        
        # Если тест уже предложен
        if self.dialog_stage == "test_offered":
            if any(word in question.lower() for word in ["да", "хочу", "давай", "рискну", "давай тест", "ок"]):
                self.dialog_stage = "after_test"
                self.last_tools_used.append("test_start")
                return {
                    "response": "Отлично! Тогда первый вопрос...",
                    "tools_used": self.last_tools_used,
                    "follow_up": False,
                    "suggestions": [],
                    "hypnotic_suggestion": False,
                    "tale_suggested": False,
                    "start_test": True  # Специальный флаг для фронтенда
                }
            else:
                response = self._handle_refusal(question)
                self.dialog_stage = "exploration"
                self.last_tools_used.append("refusal_handling")
                return {
                    "response": response,
                    "tools_used": self.last_tools_used,
                    "follow_up": True,
                    "suggestions": ["Расскажи о себе", "Что тебя беспокоит?"],
                    "hypnotic_suggestion": False,
                    "tale_suggested": False
                }
        
        # По умолчанию
        response = f"{self._get_address('playful')}, интересный вопрос. Но знаешь, чтобы ответить на него точно, а не гадать, мне нужно знать твой психологический код. {self._offer_test(category)[:100]}"
        
        return {
            "response": response,
            "tools_used": ["default"],
            "follow_up": True,
            "suggestions": ["Расскажи подробнее", "Что ещё?", "Как ты к этому относишься?"],
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }
    
    def __repr__(self) -> str:
        return f"<BenaderMode(user_id={self.user_id}, stage={self.dialog_stage})>"
