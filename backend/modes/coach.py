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
    
    ОТВЕТСТВЕННОСТЬ:
    - Помогать пользователю находить ответы внутри себя
    - Работать с конфайнтмент-моделью через вопросы
    - Разрывать циклы (loops) через осознавание
    - Использовать метафоры и аналогии
    - Не давать прямых советов
    
    ПРИНЦИПЫ РАБОТЫ С КОНФАЙНМЕНТ-МОДЕЛЬЮ:
    1. Выявлять ограничения через открытые вопросы
    2. Помогать увидеть циклы самоподдержания
    3. Находить ресурсы внутри системы
    4. Не ломать защиты, а исследовать их
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)
        
        # Инструменты коуча
        self.tools = {
            "open_questions": self._generate_open_questions,
            "loop_awareness": self._bring_awareness_to_loop,
            "reframing": self._reframe_limitation,
            "scaling": self._scale_question,
            "values_clarification": self._clarify_values,
            "exception_finding": self._find_exceptions,
            "future_pacing": self._future_pace
        }
        
        # Векторные вопросы
        self.vector_questions = {
            "СБ": [
                "Что самое страшное может случиться?",
                "Как вы обычно защищаетесь?",
                "Что было бы, если бы вы не боялись?",
                "Как ваше тело реагирует на страх?",
                "Что вы делаете, когда чувствуете угрозу?"
            ],
            "ТФ": [
                "Что для вас деньги?",
                "Как вы принимаете финансовые решения?",
                "Что бы вы делали, если бы у вас было достаточно?",
                "Какие у вас убеждения о деньгах?",
                "Что вы чувствуете, когда думаете о финансах?"
            ],
            "УБ": [
                "Как вы объясняете себе происходящее?",
                "Какие у вас есть теории о мире?",
                "Что для вас значит 'понимать'?",
                "Когда вы чувствуете, что всё поняли?",
                "Что помогает вам разобраться в сложном?"
            ],
            "ЧВ": [
                "Что важно в отношениях для вас?",
                "Как вы выбираете людей?",
                "Что происходит, когда вы доверяете?",
                "Что вы чувствуете в близких отношениях?",
                "Как вы понимаете, что отношения здоровые?"
            ]
        }
        
        logger.info(f"CoachMode инициализирован для user_id={user_id}")
    
    def get_system_prompt(self) -> str:
        """Системный промпт для режима КОУЧ с интеграцией конфайнтмент-модели"""
        
        analysis = self.analyze_profile_for_response()
        pain_points = ", ".join(analysis["pain_points"]) if analysis["pain_points"] else "не выражены"
        
        # Информация о конфайнтмент-модели
        confinement_info = ""
        if analysis["key_confinement"]:
            kc = analysis["key_confinement"]
            confinement_info = f"""
КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ:
- Название: {kc.get('name', 'не определено')}
- Описание: {kc.get('description', 'нет описания')[:100]}
- Сила: {kc.get('strength', 0):.1%}
- Тип: {kc.get('type', 'unknown')}
"""
        
        # Информация о циклах
        loops_info = ""
        if analysis["loops"]:
            loops_info = "\nЦИКЛЫ САМОПОДДЕРЖАНИЯ:\n"
            for i, loop in enumerate(analysis["loops"][:3], 1):
                loops_info += f"{i}. {loop.get('description', 'неизвестно')} (сила: {loop.get('strength', 0):.1%})\n"
        
        # Информация о слабом векторе
        weak_vector_info = ""
        if self.weakest_vector in VECTORS:
            weak_vector_info = f"""
СЛАБЫЙ ВЕКТОР: {self.weakest_vector} ({VECTORS[self.weakest_vector]['name']})
Уровень: {self.weakest_level}/6
Описание: {self.weakest_profile.get('quote', 'не определено')[:100]}
"""
        
        prompt = f"""Ты — профессиональный коуч (ICF-стиль). Твоя задача — помогать пользователю находить ответы внутри себя через открытые вопросы.

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
- Тип восприятия: {self.perception_type} (фокус: {analysis['attention_focus']})
- Уровень мышления: {self.thinking_level}/9 (глубина: {analysis['thinking_depth']})
{weak_vector_info}
- Болевые точки: {pain_points}
- Зона роста: {analysis['growth_area']}

{confinement_info}
{loops_info}

ПРИНЦИПЫ ТВОЕЙ РАБОТЫ:
1. НИКОГДА не давай прямых советов
2. Задавай открытые вопросы (Как? Что? Почему? Зачем?)
3. Помогай увидеть циклы (loops) через вопросы, а не интерпретации
4. Ищи исключения — когда ограничение НЕ работает
5. Используй шкалирование (от 1 до 10)
6. Применяй метафоры, связанные с контекстом пользователя

ТВОЙ СТИЛЬ:
- Мягкий, исследовательский
- Вовлекающий в диалог
- С акцентом на осознанность
- Используй фразы: "Что вы чувствуете?", "Как вы видите?", "Что для вас важно?"

ЗАПРЕЩЕНО:
- Интерпретировать (только вопросы)
- Говорить "я думаю", "я считаю"
- Давать готовые решения
- Оценивать

КОНТЕКСТ:
{self.get_context_string()}
"""
        return prompt
    
    def get_greeting(self) -> str:
        """Приветствие в режиме коуча"""
        name = ""
        if self.context and hasattr(self.context, 'name'):
            name = self.context.name or ""
        
        if self.weakest_vector and self.weakest_vector in VECTORS:
            greetings = [
                f"Привет, {name}. Я здесь, чтобы помочь тебе исследовать себя. С чего начнём?",
                f"{name}, давай посмотрим на твои паттерны. Что сейчас для тебя актуально?",
                f"Твой слабый вектор — {VECTORS[self.weakest_vector]['name']}. Как это проявляется в жизни?",
                f"Я заметил, что твоё ключевое ограничение связано с {self.weakest_profile.get('quote', 'твоими паттернами')[:50]}. Хочешь исследовать это?"
            ]
            return random.choice(greetings)
        
        return f"Привет, {name}. Я здесь, чтобы помочь тебе найти ответы внутри себя."
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Обрабатывает вопрос в режиме коуча
        Возвращает вопрос на вопрос (сократический диалог)
        """
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
                suggestions.append(f"📖 Кстати, есть сказка про {tale['title']} — хочешь расскажу?")
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
        """Обрабатывает вопросы про страх (вектор СБ)"""
        questions = [
            "Что именно пугает в этой ситуации?",
            "Как тело реагирует на страх?",
            "Что было бы, если бы страха не было?",
            "Когда в последний раз страх был полезен?",
            "Что ты делаешь, когда пугаешься?",
            "Какая часть тебя боится, а какая хочет действовать?",
            "О чём этот страх тебя предупреждает?"
        ]
        return random.choice(questions)
    
    def _handle_loop_question(self) -> str:
        """Обрабатывает вопросы про циклы"""
        if self.confinement_model and hasattr(self.confinement_model, 'loops') and self.confinement_model.loops:
            # Ищем самую сильную петлю
            strongest = max(self.confinement_model.loops, key=lambda x: x.get('strength', 0))
            desc = strongest.get('description', '')
            return f"Я вижу цикл: {desc}. Что обычно происходит первым в этом круге?"
        return "Расскажи подробнее про этот круг. С чего он начинается? Что происходит потом?"
    
    def _handle_money_question(self) -> str:
        """Обрабатывает вопросы про деньги (вектор ТФ)"""
        questions = [
            "Что для тебя деньги?",
            "Как ты принимаешь финансовые решения?",
            "Что бы ты делал, если бы денег было достаточно?",
            "Какие у тебя убеждения о деньгах?",
            "Что ты чувствуешь, когда получаешь деньги?",
            "Что ты чувствуешь, когда тратишь деньги?",
            "Какие послания о деньгах ты получил в детстве?"
        ]
        return random.choice(questions)
    
    def _handle_relations_question(self) -> str:
        """Обрабатывает вопросы про отношения (вектор ЧВ)"""
        questions = [
            "Что для тебя важно в отношениях?",
            "Как ты выбираешь людей?",
            "Что происходит, когда ты доверяешь?",
            "Какие отношения ты хочешь построить?",
            "Что тебе дают отношения?",
            "Что тебе сложно в отношениях?",
            "Как ты проявляешь любовь?"
        ]
        return random.choice(questions)
    
    def _handle_meaning_question(self) -> str:
        """Обрабатывает вопросы про смысл и понимание (вектор УБ)"""
        questions = [
            "Что для тебя сейчас важно понять?",
            "Как ты обычно ищешь ответы?",
            "Что помогает тебе разобраться в сложном?",
            "Когда ты чувствуешь, что всё понял?",
            "Что изменится, когда ты поймешь это?",
            "Какие вопросы для тебя самые важные?"
        ]
        return random.choice(questions)
    
    def _generate_open_question(self, question: str) -> str:
        """Генерирует открытый вопрос на основе входящего"""
        templates = [
            f"Что для вас важно в этом вопросе?",
            f"Как вы видите эту ситуацию?",
            f"Что вы чувствуете, когда думаете об этом?",
            f"Что бы вы хотели изменить?",
            f"Как это проявляется в жизни?",
            f"Что для вас самое сложное в этом?",
            f"Что бы вы хотели вместо этого?"
        ]
        return random.choice(templates)
    
    def _generate_open_questions(self, topic: str) -> List[str]:
        """Генерирует список открытых вопросов по теме"""
        questions = []
        
        # Вопросы из слабого вектора
        if self.weakest_vector in self.vector_questions:
            questions.extend(self.vector_questions[self.weakest_vector][:3])
        
        # Общие вопросы
        general = [
            "Что для вас самое сложное в этом?",
            "Когда это работает хорошо?",
            "Что бы вы хотели вместо этого?",
            "Кто мог бы поддержать вас?",
            "Что изменилось бы, если бы это было по-другому?"
        ]
        questions.extend(general)
        
        return questions[:5]
    
    def _bring_awareness_to_loop(self, loop_index: int = 0) -> str:
        """Помогает осознать цикл"""
        if not self.confinement_model or not hasattr(self.confinement_model, 'loops') or not self.confinement_model.loops:
            return "Расскажите, что повторяется в вашей жизни?"
        
        if loop_index >= len(self.confinement_model.loops):
            loop_index = 0
        
        loop = self.confinement_model.loops[loop_index]
        desc = loop.get('description', '')
        return f"Я замечаю цикл: {desc}. Что обычно происходит в самом начале?"
    
    def _reframe_limitation(self, limitation: str) -> str:
        """Переформулирует ограничение в ресурс"""
        reframes = {
            "страх": "осторожность, которая когда-то помогла выжить",
            "лень": "способ экономить энергию для важного",
            "тревога": "внимание к деталям и готовность",
            "агрессия": "энергия для защиты своих границ",
            "неуверенность": "внимательность и осторожность",
            "обида": "сигнал о нарушенных границах"
        }
        
        for key, reframe in reframes.items():
            if key in limitation.lower():
                return f"А что, если посмотреть на это как на {reframe}?"
        
        return "Как ещё можно назвать это качество?"
    
    def _scale_question(self, topic: str, current: int = None) -> str:
        """Задаёт шкалирующий вопрос"""
        if current is None:
            return f"Оцените от 1 до 10, насколько {topic} вас беспокоит?"
        else:
            return f"Что нужно, чтобы с {current} подняться на 1 балл выше?"
    
    def _clarify_values(self) -> str:
        """Помогает прояснить ценности"""
        return "Что для вас действительно важно в этой ситуации?"
    
    def _find_exceptions(self, problem: str) -> str:
        """Ищет исключения из проблемы"""
        return f"Бывает ли так, что {problem} НЕ происходит? Что тогда по-другому?"
    
    def _future_pace(self, goal: str) -> str:
        """Помогает представить будущее"""
        return f"Представьте, что {goal} уже случилось. Что изменилось? Что вы чувствуете?"
    
    def _generate_suggestions(self) -> List[str]:
        """Генерирует предложения для продолжения"""
        suggestions = []
        
        if self.weakest_vector == "СБ":
            suggestions.append("❓ Хочешь исследовать свои страхи глубже?")
        elif self.weakest_vector == "ТФ":
            suggestions.append("💰 Поговорим о твоих финансовых убеждениях?")
        elif self.weakest_vector == "УБ":
            suggestions.append("🔍 Исследуем, как ты понимаешь мир?")
        elif self.weakest_vector == "ЧВ":
            suggestions.append("🤝 Хочешь разобраться в отношениях?")
        
        suggestions.append("🧠 Что для тебя сейчас самое важное?")
        suggestions.append("🎯 Какая цель сейчас перед тобой?")
        
        return suggestions
    
    def get_tools_description(self) -> Dict[str, str]:
        """Возвращает описание доступных инструментов"""
        return {
            "open_questions": "Задаю открытые вопросы, чтобы помочь тебе найти ответы внутри себя",
            "loop_awareness": "Помогаю увидеть повторяющиеся циклы в твоей жизни",
            "reframing": "Предлагаю посмотреть на ситуацию под другим углом",
            "scaling": "Использую шкалу от 1 до 10 для оценки прогресса",
            "values_clarification": "Помогаю прояснить твои истинные ценности",
            "exception_finding": "Ищу моменты, когда проблема не проявляется",
            "future_pacing": "Предлагаю представить желаемое будущее"
        }
