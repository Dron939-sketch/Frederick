#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ КОУЧ (coach.py)
Партнёрский стиль общения. Помогает находить ответы внутри себя через открытые вопросы.
Интегрирован с конфайнтмент-моделью для работы с ограничениями и циклами.
"""

from typing import Dict, Any, List, Optional
import random
import logging

from .base_mode import BaseMode
from profiles import VECTORS, LEVEL_PROFILES

logger = logging.getLogger(__name__)


class CoachMode(BaseMode):
    """
    Режим КОУЧ - партнёрский стиль общения.
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)
        
        self.tools = {
            "open_questions": self._generate_open_questions,
            "loop_awareness": self._bring_awareness_to_loop,
            "reframing": self._reframe_limitation,
            "scaling": self._scale_question,
            "values_clarification": self._clarify_values,
            "exception_finding": self._find_exceptions,
            "future_pacing": self._future_pace
        }
        
        self.vector_questions = {
            "СБ": [
                "Расскажи, что происходит, когда ты чувствуешь давление? Что ты замечаешь в себе в такие моменты?",
                "Если бы ты мог представить свой страх в виде образа, что бы это было?",
                "Как ты думаешь, что твой страх пытается тебе сказать или защитить тебя от чего?",
                "Бывают ли моменты, когда ты чувствуешь себя уверенно? Что тогда по-другому?",
                "Что было бы, если бы ты позволил себе быть уязвимым в этой ситуации?"
            ],
            "ТФ": [
                "Что для тебя значат деньги? Какие чувства возникают, когда ты о них думаешь?",
                "Если бы деньги были человеком, какие отношения у вас были бы?",
                "Что ты помнишь о деньгах из детства? Какие послания ты получил?",
                "Как бы ты хотел относиться к деньгам? Что для этого нужно?",
                "Что бы ты делал, если бы денег было достаточно для всего, что тебе нужно?"
            ],
            "УБ": [
                "Как ты обычно разбираешься в сложных вещах? Что тебе помогает?",
                "Что для тебя значит 'понять'? Как ты понимаешь, что понял?",
                "Бывают ли моменты, когда мир кажется простым и понятным? Что тогда происходит?",
                "Какие вопросы для тебя самые важные? На что ты ищешь ответы?",
                "Если бы у тебя была волшебная палочка, что бы ты хотел понять прямо сейчас?"
            ],
            "ЧВ": [
                "Расскажи о своих близких отношениях. Что для тебя в них самое ценное?",
                "Как ты выбираешь людей, которых впускаешь в свою жизнь?",
                "Что происходит, когда ты доверяешь человеку? А что мешает доверять?",
                "Какие отношения ты хотел бы построить? Что для этого важно?",
                "Как ты проявляешь заботу о близких? А как они проявляют заботу о тебе?"
            ]
        }
        
        logger.info(f"CoachMode инициализирован для user_id={user_id}")
    
    def get_system_prompt(self) -> str:
        """Системный промпт для режима КОУЧ — тёплый и поддерживающий"""
        
        analysis = self.analyze_profile_for_response()
        pain_points = ", ".join(analysis["pain_points"]) if analysis["pain_points"] else "пока не выражены"
        
        # Информация о конфайнтмент-модели
        confinement_info = ""
        if analysis["key_confinement"]:
            kc = analysis["key_confinement"]
            confinement_info = f"""
🌱 КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ:
- Название: {kc.get('name', 'не определено')}
- Описание: {kc.get('description', 'нет описания')[:150]}
- Сила: {kc.get('strength', 0):.1%}
- Тип: {kc.get('type', 'unknown')}
"""
        
        # Информация о циклах
        loops_info = ""
        if analysis["loops"]:
            loops_info = "\n🔄 ЦИКЛЫ, КОТОРЫЕ МОЖНО ИССЛЕДОВАТЬ:\n"
            for i, loop in enumerate(analysis["loops"][:3], 1):
                loops_info += f"{i}. {loop.get('description', 'неизвестно')} (сила: {loop.get('strength', 0):.1%})\n"
        
        # Информация о слабом векторе
        weak_vector_info = ""
        if self.weakest_vector in VECTORS:
            weak_vector_info = f"""
📊 ТВОЙ ВЕКТОР ДЛЯ ИССЛЕДОВАНИЯ: {self.weakest_vector} ({VECTORS[self.weakest_vector]['name']})
Уровень: {self.weakest_level}/6
Описание: {self.weakest_profile.get('quote', 'не определено')[:150]}
"""
        
        prompt = f"""Ты — Фреди, профессиональный коуч. Твоя главная задача — помогать человеку находить ответы внутри себя через мягкие, открытые вопросы.

🌟 О ТВОЁМ СОБЕСЕДНИКЕ:
- Тип восприятия: {self.perception_type} (фокус: {analysis['attention_focus']})
- Уровень мышления: {self.thinking_level}/9 (глубина: {analysis['thinking_depth']})
{weak_vector_info}
- Болевые точки: {pain_points}
- Зона роста: {analysis['growth_area']}

{confinement_info}
{loops_info}

🤝 ТВОЙ СТИЛЬ ОБЩЕНИЯ:
- Говори тёпло, мягко, с эмпатией
- Используй обращения: "друг мой", "дорогой", "послушай", "поделись"
- Показывай, что ты слышишь и понимаешь
- Будь искренним и поддерживающим
- Задавай вопросы из любопытства, а не для проверки

💡 КАК ЗАДАВАТЬ ВОПРОСЫ:
- Начинай с мягких фраз: "Расскажи...", "Что ты чувствуешь...", "Как для тебя...", "Что было бы, если...", "Поделись..."
- Задавай открытые вопросы (не на "да"/"нет")
- Используй шкалирование: "Оцени от 1 до 10, насколько..."
- Ищи исключения: "Бывает ли так, что...?"
- Помогай представить будущее: "Представь, что..."

❌ ЧЕГО НЕ ДЕЛАТЬ:
- Не давай прямых советов
- Не интерпретируй (просто спрашивай)
- Не говори "я думаю", "я считаю" — важно его мнение
- Не оценивай

✨ ПРИМЕРЫ ТВОИХ ОТВЕТОВ:
- "Я слышу, как тебе непросто. Расскажи подробнее, что происходит?"
- "Спасибо, что делишься. Как ты себя чувствуешь, когда думаешь об этом?"
- "Это важная тема. Что для тебя самое сложное в этой ситуации?"
- "Интересно... А бывают моменты, когда это не так? Что тогда по-другому?"

📝 КОНТЕКСТ:
{self.get_context_string()}

Теперь начни диалог тёпло и поддерживающе. Спроси, что для человека сейчас важно, и помоги ему исследовать себя."""
        
        return prompt
    
    def get_greeting(self) -> str:
        """Тёплое приветствие в режиме коуча"""
        name = ""
        if self.context and hasattr(self.context, 'name'):
            name = self.context.name or ""
        
        greetings = [
            f"Привет, {name} ❤️ Рад тебя видеть. Как настроение? Что для тебя сейчас важно?",
            f"{name}, я здесь. Расскажи, что происходит в твоей жизни?",
            f"Здравствуй, {name}. Как ты себя чувствуешь сегодня? С чего хочешь начать наш разговор?",
            f"Приветствую тебя, {name}. Я рядом, если хочешь о чём-то поговорить или над чем-то поразмышлять.",
            f"{name}, давай сегодня вместе исследуем что-то важное для тебя. С чего начнём?"
        ]
        
        if self.weakest_vector and self.weakest_vector in VECTORS:
            greetings.append(
                f"{name}, я заметил, что тебе может быть интересно исследовать тему {VECTORS[self.weakest_vector]['name'].lower()}. Как ты думаешь, это актуально для тебя сейчас?"
            )
        
        return random.choice(greetings)
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """Обрабатывает вопрос в режиме коуча"""
        question_lower = question.lower()
        self.last_tools_used = []
        
        # 1. Если вопрос про страх (вектор СБ)
        if any(word in question_lower for word in ["боюсь", "страх", "тревога", "опас", "пуга"]) and self.weakest_vector == "СБ":
            response = self._handle_fear_question()
            self.last_tools_used.append("fear_work")
        
        # 2. Если вопрос про цикл
        elif any(word in question_lower for word in ["замкнутый круг", "повторяется", "снова", "опять", "цикл"]):
            response = self._handle_loop_question()
            self.last_tools_used.append("loop_awareness")
        
        # 3. Если вопрос про деньги (вектор ТФ)
        elif any(word in question_lower for word in ["деньги", "заработать", "финансы", "доход", "бюджет"]):
            response = self._handle_money_question()
            self.last_tools_used.append("money_coaching")
        
        # 4. Если вопрос про отношения (вектор ЧВ)
        elif any(word in question_lower for word in ["отношения", "люди", "один", "друг", "партнер", "семья"]):
            response = self._handle_relations_question()
            self.last_tools_used.append("relations_coaching")
        
        # 5. Если вопрос про смысл/понимание (вектор УБ)
        elif any(word in question_lower for word in ["смысл", "почему", "зачем", "понять", "разобраться"]):
            response = self._handle_meaning_question()
            self.last_tools_used.append("meaning_coaching")
        
        # 6. По умолчанию - открытый вопрос
        else:
            response = self._generate_open_question(question)
            self.last_tools_used.append("open_question")
        
        # Сохраняем в историю
        self.save_to_history(question, response)
        
        # Генерируем предложения для продолжения
        suggestions = self._generate_suggestions()
        
        # Проверяем, нужно ли предложить сказку (20% chance)
        tale_suggested = False
        if random.random() < 0.2:
            tale = self.suggest_tale()
            if tale and tale.get('title'):
                suggestions.append(f"📖 Кстати, у меня есть терапевтическая сказка — она про {tale['title']}. Хочешь, расскажу?")
                tale_suggested = True
        
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "follow_up": True,
            "suggestions": suggestions,
            "hypnotic_suggestion": False,
            "tale_suggested": tale_suggested
        }
    
    def _handle_fear_question(self) -> str:
        """Мягко исследует страх"""
        questions = [
            "Спасибо, что делишься. Расскажи, что именно в этой ситуации вызывает страх? Что ты чувствуешь в теле?",
            "Я слышу, что тебе страшно. Это важное чувство. Что бы ты хотел сделать с этим страхом?",
            "Как ты думаешь, о чём этот страх пытается тебя предупредить? Возможно, он хочет защитить тебя от чего-то?",
            "Бывают ли моменты, когда страх отступает? Что тогда происходит по-другому?",
            "Если бы ты мог представить свой страх в виде образа, что бы это было? И что бы ты сказал этому образу?",
            "Что было бы, если бы ты позволил себе быть храбрым прямо сейчас? Что изменилось бы?"
        ]
        return random.choice(questions)
    
    def _handle_loop_question(self) -> str:
        """Мягко исследует цикл"""
        if self.confinement_model and hasattr(self.confinement_model, 'loops') and self.confinement_model.loops:
            strongest = max(self.confinement_model.loops, key=lambda x: x.get('strength', 0))
            desc = strongest.get('description', '')
            return f"Я замечаю, что в твоей жизни есть повторяющийся паттерн: {desc}. Интересно, с чего он обычно начинается? Что происходит первым?"
        return "Расскажи подробнее про этот круг. С чего он обычно начинается? А что происходит дальше?"
    
    def _handle_money_question(self) -> str:
        """Мягко исследует отношение к деньгам"""
        questions = [
            "Расскажи о своих чувствах, когда думаешь о деньгах. Что всплывает?",
            "Какие у тебя были послания о деньгах в детстве? Что говорили родители?",
            "Если бы деньги могли говорить, что бы они сказали тебе?",
            "Представь, что у тебя достаточно денег для всего, что тебе нужно. Что изменилось бы в твоей жизни?",
            "Как ты хочешь относиться к деньгам? Что для этого нужно?",
            "Бывают ли моменты, когда деньги приходят легко? Что тогда по-другому?"
        ]
        return random.choice(questions)
    
    def _handle_relations_question(self) -> str:
        """Мягко исследует отношения"""
        questions = [
            "Расскажи о том, какие отношения для тебя самые важные. Что в них ценно?",
            "Как ты понимаешь, что отношения здоровые? Что для этого нужно?",
            "Что тебе сложно в отношениях? А что легко?",
            "Если бы ты мог создать идеальные отношения, какими бы они были?",
            "Как ты проявляешь заботу о близких? А как они проявляют заботу о тебе?",
            "Что для тебя значит 'доверие'? Как ты узнаёшь, что можно доверять?"
        ]
        return random.choice(questions)
    
    def _handle_meaning_question(self) -> str:
        """Мягко исследует смыслы"""
        questions = [
            "Какой вопрос для тебя сейчас самый важный? Что ты хочешь понять?",
            "Расскажи, как ты обычно ищешь ответы на сложные вопросы. Что тебе помогает?",
            "Что для тебя значит 'понять'? Как ты понимаешь, что понял?",
            "Бывают ли моменты ясности? Что тогда происходит?",
            "Если бы у тебя была возможность задать один вопрос Вселенной, что бы это был за вопрос?",
            "Что изменится в твоей жизни, когда ты найдёшь ответ на этот вопрос?"
        ]
        return random.choice(questions)
    
    def _generate_open_question(self, question: str) -> str:
        """Генерирует мягкий открытый вопрос"""
        templates = [
            f"Спасибо, что поделился. Расскажи, что для тебя важно в этом вопросе?",
            f"Я слышу тебя. Как ты видишь эту ситуацию?",
            f"Это интересно. Что ты чувствуешь, когда думаешь об этом?",
            f"Что бы ты хотел изменить в этой ситуации?",
            f"Как это проявляется в твоей жизни?",
            f"Что для тебя самое сложное в этом?",
            f"А что было бы, если бы всё сложилось так, как ты хочешь?",
            f"Поделись, какие мысли приходят в голову, когда ты об этом думаешь?"
        ]
        return random.choice(templates)
    
    def _generate_open_questions(self, topic: str) -> List[str]:
        """Генерирует список мягких открытых вопросов по теме"""
        questions = []
        
        if self.weakest_vector in self.vector_questions:
            questions.extend(self.vector_questions[self.weakest_vector][:3])
        
        general = [
            "Что для тебя самое сложное в этом?",
            "Когда это работает хорошо? Что тогда происходит?",
            "Что бы ты хотел вместо этого?",
            "Кто мог бы поддержать тебя в этом?",
            "Что изменилось бы, если бы это было по-другому?",
            "Как ты себя чувствуешь, когда думаешь об этом?"
        ]
        questions.extend(general)
        
        return questions[:5]
    
    def _bring_awareness_to_loop(self, loop_index: int = 0) -> str:
        """Помогает осознать цикл мягко"""
        if not self.confinement_model or not hasattr(self.confinement_model, 'loops') or not self.confinement_model.loops:
            return "Расскажи, что в твоей жизни повторяется? Бывает такое чувство, что ты уже был в похожей ситуации?"
        
        if loop_index >= len(self.confinement_model.loops):
            loop_index = 0
        
        loop = self.confinement_model.loops[loop_index]
        desc = loop.get('description', '')
        return f"Я замечаю интересный паттерн: {desc}. Интересно, с чего он начинается? Что происходит первым в этом круге?"
    
    def _reframe_limitation(self, limitation: str) -> str:
        """Мягко переформулирует ограничение в ресурс"""
        reframes = {
            "страх": "осторожность, которая когда-то помогла тебе выжить. Интересно, от чего он пытается тебя защитить сейчас?",
            "лень": "способ беречь энергию для того, что действительно важно. Что для тебя сейчас по-настоящему важно?",
            "тревога": "внимание к деталям и готовность к разным вариантам. Что твоя тревога пытается тебе подсказать?",
            "агрессия": "энергия для защиты своих границ. Какие твои границы нуждаются в защите?",
            "неуверенность": "внимательность и осторожность. Что помогает тебе чувствовать себя увереннее?",
            "обида": "сигнал о нарушенных границах. Какие твои границы были нарушены?"
        }
        
        for key, reframe in reframes.items():
            if key in limitation.lower():
                return f"А что, если посмотреть на это как на {reframe}"
        
        return "Интересно, как ещё можно назвать это качество? Может, оно несёт в себе что-то полезное?"
    
    def _scale_question(self, topic: str, current: int = None) -> str:
        """Задаёт шкалирующий вопрос мягко"""
        if current is None:
            return f"Оцени от 1 до 10, насколько {topic} влияет на твою жизнь? 1 — совсем не влияет, 10 — очень сильно."
        else:
            return f"Ты оценил на {current}. Что нужно, чтобы подняться на 1 балл выше? Какой самый маленький шаг можно сделать?"
    
    def _clarify_values(self) -> str:
        """Помогает прояснить ценности мягко"""
        return "Что для тебя сейчас действительно важно в этой ситуации? Какие ценности здесь затронуты?"
    
    def _find_exceptions(self, problem: str) -> str:
        """Мягко ищет исключения"""
        return f"Бывает ли так, что {problem} НЕ происходит? Что тогда по-другому? Что ты делаешь в такие моменты?"
    
    def _future_pace(self, goal: str) -> str:
        """Мягко помогает представить будущее"""
        return f"Представь, что {goal} уже случилось. Закрой глаза на минуту... Что изменилось в твоей жизни? Что ты чувствуешь? Что видишь вокруг?"
    
    def _generate_suggestions(self) -> List[str]:
        """Генерирует мягкие предложения для продолжения"""
        suggestions = []
        
        if self.weakest_vector == "СБ":
            suggestions.append("❓ Хочешь глубже исследовать свои страхи? Я могу задать несколько вопросов.")
        elif self.weakest_vector == "ТФ":
            suggestions.append("💰 Поговорим о твоих отношениях с деньгами? Это интересная тема.")
        elif self.weakest_vector == "УБ":
            suggestions.append("🔍 Может, исследуем, как ты понимаешь мир и находишь ответы?")
        elif self.weakest_vector == "ЧВ":
            suggestions.append("🤝 Хочешь разобраться в отношениях? Расскажи, что для тебя важно.")
        
        suggestions.append("🧠 Что для тебя сейчас самое важное? С чего хочешь начать?")
        suggestions.append("🎯 Какая цель сейчас перед тобой? Что бы ты хотел изменить?")
        
        return suggestions
    
    def get_tools_description(self) -> Dict[str, str]:
        """Возвращает описание доступных инструментов"""
        return {
            "open_questions": "Задаю мягкие вопросы, чтобы ты сам нашёл ответы",
            "loop_awareness": "Помогаю заметить повторяющиеся паттерны в жизни",
            "reframing": "Предлагаю посмотреть на ситуацию под другим углом",
            "scaling": "Помогаю оценить прогресс от 1 до 10",
            "values_clarification": "Помогаю понять, что для тебя действительно важно",
            "exception_finding": "Ищу моменты, когда проблема не проявляется",
            "future_pacing": "Предлагаю представить желаемое будущее"
        }
