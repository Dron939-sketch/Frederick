#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ КОУЧ (coach.py)
Партнёрский стиль общения. Помогает находить ответы внутри себя через открытые вопросы.
Образ: Бертран Рассел — мудрый философ, скептик, ценитель ясности мысли и свободы разума.
ВЕРСИЯ 3.1 — С ПОДКЛЮЧЕНИЕМ AI-СЕРВИСА
"""

from typing import Dict, Any, List, Optional
import random
import logging
from datetime import datetime

from .base_mode import BaseMode
from profiles import VECTORS, LEVEL_PROFILES
from services.ai_service import AIService  # ДОБАВЛЕН ИМПОРТ

logger = logging.getLogger(__name__)


class CoachMode(BaseMode):
    """
    Режим КОУЧ — философский, мудрый, помогающий найти ясность через вопросы.
    
    ОБРАЗ (внутренний):
    - Бертран Рассел — британский философ, логик, математик
    - Ценит ясность мысли и свободу от догм
    - Скептичен к готовым ответам, помогает искать свои
    - Глубоко человечен, сострадателен
    - Верит в силу разума и любопытства
    
    ДЛЯ ПОЛЬЗОВАТЕЛЯ:
    - Мудрый собеседник, помогающий разобраться в себе
    - Задаёт вопросы, которые проясняют
    - Не даёт готовых ответов, но помогает найти свои
    - Поддерживает через любопытство и принятие
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)
        
        # ДОБАВЛЕН AI-СЕРВИС
        self.ai_service = AIService()
        
        self.tools = {
            "open_questions": self._generate_open_questions,
            "loop_awareness": self._bring_awareness_to_loop,
            "reframing": self._reframe_limitation,
            "scaling": self._scale_question,
            "values_clarification": self._clarify_values,
            "exception_finding": self._find_exceptions,
            "future_pacing": self._future_pace,
            "logical_analysis": self._logical_analysis
        }
        
        # Философские цитаты Рассела (для вдохновения)
        self.russell_quotes = [
            "Три страсти, простые и непреодолимо сильные, управляли моей жизнью: жажда любви, поиск знания и невыносимое сострадание к страданиям человечества.",
            "Любую проблему, которая не может быть решена, можно сделать меньше, научившись жить с ней.",
            "Страх — вот источник того, что люди называют злом. Большая часть зла в мире происходит от страха.",
            "Я никогда не позволял школе мешать моему образованию.",
            "Вера в истину начинается с сомнения в том, во что верят другие.",
            "Самый продуктивный способ думать — задавать правильные вопросы."
        ]
        
        self.vector_questions = {
            "СБ": [
                "Расскажи, что происходит, когда ты чувствуешь давление? Интересно, что говорит тебе твой страх?",
                "Если бы ты мог представить свой страх в виде образа, что бы это было? Страх часто возникает из неизвестности.",
                "Бывают ли моменты, когда ты чувствуешь себя уверенно? Что тогда по-другому?",
                "Страх — это часто просто воображение, рисующее худшие сценарии. Что, если позволить себе быть уязвимым?"
            ],
            "ТФ": [
                "Что для тебя значат деньги? Интересно, как они связаны с твоим чувством свободы?",
                "Если бы деньги не были проблемой, чем бы ты занимался? Что бы ты делал ради самого процесса?",
                "Какие послания о деньгах ты получил в детстве? Иногда стоит пересмотреть их.",
                "Финансовая свобода — это не столько о количестве, сколько о качестве твоих отношений с ресурсами."
            ],
            "УБ": [
                "Как ты обычно разбираешься в сложных вещах? Я верю, что любопытство — лучший учитель.",
                "Что для тебя значит 'понять'? Как ты понимаешь, что понял? Это интересный вопрос.",
                "Бывают ли моменты, когда мир кажется простым и понятным? Что тогда происходит?",
                "Самые важные вопросы часто не имеют готовых ответов. Важно — сам поиск."
            ],
            "ЧВ": [
                "Расскажи о своих близких отношениях. Что для тебя в них самое ценное?",
                "Как ты выбираешь людей, которых впускаешь в свою жизнь? Качество окружения формирует качество мыслей.",
                "Что происходит, когда ты доверяешь человеку? А что мешает доверять?",
                "Доверие — это риск. Но без риска нет и глубины отношений. Как ты чувствуешь этот баланс?"
            ]
        }
        
        logger.info(f"📖 CoachMode (Russell) инициализирован для user_id={user_id}")
    
    def get_system_prompt(self) -> str:
        """Системный промпт для режима КОУЧ — мудрый, философский, скептичный к догмам"""
        
        analysis = self.analyze_profile_for_response()
        pain_points = ", ".join(analysis["pain_points"]) if analysis["pain_points"] else "пока не выражены"
        
        # Философская цитата дня
        quote = random.choice(self.russell_quotes)
        
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
        
        prompt = f"""Ты — Фреди. Твой стиль вдохновлён философией Бертрана Рассела: ясность мысли, скептицизм к готовым ответам, глубокая человечность и вера в силу разума.

✨ ЦИТАТА ДНЯ:
«{quote}»

🌟 О СОБЕСЕДНИКЕ:
- Тип восприятия: {self.perception_type} (фокус: {analysis['attention_focus']})
- Уровень мышления: {self.thinking_level}/9 (глубина: {analysis['thinking_depth']})
{weak_vector_info}
- Болевые точки: {pain_points}
- Зона роста: {analysis['growth_area']}

{confinement_info}
{loops_info}

🤝 ТВОЙ СТИЛЬ ОБЩЕНИЯ:
- Ты говоришь спокойно, вдумчиво, как философ, размышляющий вслух
- Ты ценишь ясность мысли и свободу от догм
- Ты скептичен к готовым ответам — помогаешь человеку найти свои
- Ты задаёшь вопросы не для проверки, а из искреннего любопытства
- Ты мягко указываешь на противоречия, но без осуждения

💡 КАК ЗАДАВАТЬ ВОПРОСЫ:
- "Интересно, что заставляет тебя так думать?"
- "А если посмотреть на это с другой стороны?"
- "Что было бы, если бы ты позволил себе усомниться в этом убеждении?"
- "Какую роль играет страх в этом решении?"
- "Что для тебя действительно важно — и почему?"

❌ ЧЕГО НЕ ДЕЛАТЬ:
- Не давай готовых решений — это противоречит духу свободы мысли
- Не осуждай и не оценивай
- Не навязывай свою точку зрения
- Не игнорируй противоречия — исследуй их

✨ ПРИМЕРЫ ТВОИХ ОТВЕТОВ:
- "Это интересный вопрос. А что, если посмотреть на него не с точки зрения 'правильно/неправильно', а с точки зрения 'что для тебя важно'?"
- "Я замечаю противоречие. С одной стороны, ты говоришь..., с другой —... Как это уживается в тебе?"
- "Страх часто возникает из неизвестности. Что, если просто побыть с этим страхом, не убегая и не борясь?"
- "Интересно, откуда взялось это убеждение? Твоё ли оно? Или ты его получил от кого-то?"

📝 КОНТЕКСТ:
{self.get_context_string()}

Теперь начни диалог. Будь мудрым собеседником, помогающим через вопросы, а не ответы."""
        
        return prompt
    
    def get_greeting(self) -> str:
        """Мудрое приветствие в стиле Рассела"""
        name = ""
        if self.context and hasattr(self.context, 'name'):
            name = self.context.name or ""
        
        greetings = [
            f"Здравствуйте, {name}. Интересно, что привело вас сюда сегодня? Какие вопросы занимают ваш ум?",
            f"{name}, я рад нашей встрече. Знаете, я заметил, что самые важные открытия начинаются с хорошего вопроса. Что вас волнует сейчас?",
            f"Добрый день, {name}. Я верю, что ясность мысли приходит через диалог. С чего бы вы хотели начать?",
            f"{name}, давайте вместе исследуем то, что для вас сейчас важно. Какой вопрос вы задаёте себе чаще всего?",
            f"Здравствуйте, {name}. Иногда самый трудный вопрос — это 'чего я на самом деле хочу?'. Что вы скажете?"
        ]
        
        if self.weakest_vector and self.weakest_vector in VECTORS:
            greetings.append(
                f"{name}, я заметил, что в вашей жизни может быть важно исследовать тему {VECTORS[self.weakest_vector]['name'].lower()}. Как вы думаете, это актуально?"
            )
        
        return random.choice(greetings)
    
    # ========== ДОБАВЛЕН НОВЫЙ МЕТОД ДЛЯ AI ==========
    async def process_question_streaming(self, question: str):
        """Потоковая обработка вопроса через AI с учётом профиля"""
        
        # Собираем данные профиля для AI
        profile = {
            'profile_data': self.profile_data,
            'perception_type': self.perception_type,
            'thinking_level': self.thinking_level,
            'behavioral_levels': self.behavioral_levels,
            'deep_patterns': self.deep_patterns,
            'weakest_vector': getattr(self, 'weakest_vector', None),
            'weakest_level': getattr(self, 'weakest_level', None)
        }
        
        context_data = {
            'name': self.context.name if self.context else None,
            'city': self.context.city if self.context else None,
            'age': self.context.age if self.context else None
        }
        
        full_response = ""
        async for chunk in self.ai_service.generate_response_streaming(
            message=question,
            context=context_data,
            profile=profile,
            mode='coach'
        ):
            if chunk:
                full_response += chunk
                yield chunk
        
        if not full_response:
            # Fallback на философский вопрос
            yield self._generate_philosophical_question(question)
        
        self.save_to_history(question, full_response)
    # =================================================
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """Обрабатывает вопрос в философском стиле (синхронная версия, используется как fallback)"""
        question_lower = question.lower()
        self.last_tools_used = []
        
        # 1. Если вопрос про страх
        if any(word in question_lower for word in ["боюсь", "страх", "тревога", "опас", "пуга"]):
            response = self._handle_fear_question()
            self.last_tools_used.append("fear_inquiry")
        
        # 2. Если вопрос про цикл
        elif any(word in question_lower for word in ["замкнутый круг", "повторяется", "снова", "опять", "цикл"]):
            response = self._handle_loop_question()
            self.last_tools_used.append("loop_inquiry")
        
        # 3. Если вопрос про деньги
        elif any(word in question_lower for word in ["деньги", "заработать", "финансы", "доход", "бюджет"]):
            response = self._handle_money_question()
            self.last_tools_used.append("money_inquiry")
        
        # 4. Если вопрос про отношения
        elif any(word in question_lower for word in ["отношения", "люди", "один", "друг", "партнер", "семья"]):
            response = self._handle_relations_question()
            self.last_tools_used.append("relations_inquiry")
        
        # 5. Если вопрос про смысл
        elif any(word in question_lower for word in ["смысл", "почему", "зачем", "понять", "разобраться"]):
            response = self._handle_meaning_question()
            self.last_tools_used.append("meaning_inquiry")
        
        # 6. Если вопрос про противоречие
        elif any(word in question_lower for word in ["противоречие", "не могу решить", "между", "или"]):
            response = self._handle_contradiction(question)
            self.last_tools_used.append("contradiction_inquiry")
        
        # 7. По умолчанию - открытый философский вопрос
        else:
            response = self._generate_philosophical_question(question)
            self.last_tools_used.append("philosophical_inquiry")
        
        # Сохраняем в историю
        self.save_to_history(question, response)
        
        # Генерируем предложения
        suggestions = self._generate_philosophical_suggestions()
        
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "follow_up": True,
            "suggestions": suggestions,
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }
    
    def _handle_fear_question(self) -> str:
        """Философское исследование страха"""
        questions = [
            "Страх — это интересное явление. Он может защищать, а может парализовать. Что, по-вашему, пытается защитить ваш страх?",
            "Рассел писал, что большая часть зла в мире происходит от страха. Что, если просто наблюдать за страхом, не пытаясь его победить?",
            "Интересно, откуда пришёл этот страх? Какую историю он рассказывает?",
            "Бывают ли моменты, когда страх отступает? Что тогда происходит по-другому?",
            "Что было бы, если бы вы позволили себе быть храбрым — не для кого-то, а для себя?"
        ]
        return random.choice(questions)
    
    def _handle_loop_question(self) -> str:
        """Исследование повторяющихся паттернов"""
        if self.confinement_model and hasattr(self.confinement_model, 'loops') and self.confinement_model.loops:
            strongest = max(self.confinement_model.loops, key=lambda x: x.get('strength', 0))
            desc = strongest.get('description', '')
            return f"Я замечаю повторяющийся паттерн: {desc}. Интересно, что обычно запускает этот цикл? И что его поддерживает?"
        return "Циклы интересны тем, что они самоподдерживаются. Что, по-вашему, держит этот круг? С чего он начинается?"
    
    def _handle_money_question(self) -> str:
        """Философское исследование денег"""
        questions = [
            "Деньги — это любопытная конструкция. Что они означают для вас? Свободу? Безопасность? Возможности?",
            "Если бы деньги не были проблемой, чем бы вы занимались? Что бы делали ради самого процесса?",
            "Какие послания о деньгах вы получили в детстве? Стоит ли их пересмотреть?",
            "Интересно, как ваше отношение к деньгам связано с вашим чувством собственной ценности?"
        ]
        return random.choice(questions)
    
    def _handle_relations_question(self) -> str:
        """Философское исследование отношений"""
        questions = [
            "Отношения — это, возможно, самое важное в жизни. Что для вас ценно в близости?",
            "Как вы понимаете, что отношения здоровые? Что для этого нужно?",
            "Интересно, что мешает вам быть полностью собой с другими?",
            "Доверие — это риск. Как вы находите баланс между открытостью и безопасностью?"
        ]
        return random.choice(questions)
    
    def _handle_meaning_question(self) -> str:
        """Философское исследование смысла"""
        questions = [
            "Какой вопрос для вас сейчас самый важный? Иногда сам вопрос важнее ответа.",
            "Расскажите, как вы обычно ищете ответы на сложные вопросы. Что вам помогает?",
            "Что для вас значит 'понять'? Как вы понимаете, что поняли?",
            "Бывают ли моменты ясности? Что тогда происходит?"
        ]
        return random.choice(questions)
    
    def _handle_contradiction(self, question: str) -> str:
        """Исследует противоречия"""
        return f"Интересное противоречие. С одной стороны... с другой... Как это уживается в вас? Что, если оба утверждения могут быть верны?"
    
    def _generate_philosophical_question(self, question: str) -> str:
        """Генерирует философский открытый вопрос"""
        templates = [
            f"Интересный вопрос. А что, если посмотреть на него не с точки зрения 'правильно/неправильно', а с точки зрения 'что для вас важно'?",
            f"Я слышу вас. Как вы сами отвечаете на этот вопрос?",
            f"Это напоминает мне о том, как важно задавать правильные вопросы. Что, по-вашему, скрывается за этим вопросом?",
            f"А что было бы, если бы вы позволили себе усомниться в самом вопросе?",
            f"Интересно, откуда взялось это убеждение? Ваше ли оно? Или вы его получили от кого-то?"
        ]
        return random.choice(templates)
    
    def _logical_analysis(self, statement: str) -> str:
        """Логический анализ утверждения"""
        return f"Давайте разберём это логически. Если {statement}, то какие из этого следуют выводы? А что из этого вытекает?"
    
    def _generate_open_questions(self, topic: str) -> List[str]:
        """Генерирует список философских вопросов"""
        questions = []
        
        if self.weakest_vector in self.vector_questions:
            questions.extend(self.vector_questions[self.weakest_vector][:3])
        
        general = [
            "Что для вас самое сложное в этом?",
            "Когда это работает хорошо? Что тогда происходит?",
            "Что бы вы хотели вместо этого?",
            "Как вы себя чувствуете, когда думаете об этом?",
            "Что, если посмотреть на это с другой стороны?"
        ]
        questions.extend(general)
        
        return questions[:5]
    
    def _bring_awareness_to_loop(self, loop_index: int = 0) -> str:
        """Помогает осознать цикл философски"""
        if not self.confinement_model or not hasattr(self.confinement_model, 'loops') or not self.confinement_model.loops:
            return "Расскажите, что в вашей жизни повторяется? Бывает такое чувство, что вы уже были в похожей ситуации?"
        
        if loop_index >= len(self.confinement_model.loops):
            loop_index = 0
        
        loop = self.confinement_model.loops[loop_index]
        desc = loop.get('description', '')
        return f"Я замечаю паттерн: {desc}. Интересно, с чего он начинается? Что происходит первым в этом круге?"
    
    def _reframe_limitation(self, limitation: str) -> str:
        """Философское переосмысление ограничения"""
        reframes = {
            "страх": "осторожность, которая когда-то помогла вам выжить. От чего он пытается вас защитить сейчас?",
            "лень": "способ беречь энергию для того, что действительно важно. Что для вас сейчас по-настоящему важно?",
            "тревога": "внимание к деталям и готовность к разным вариантам. Что ваша тревога пытается вам подсказать?",
            "агрессия": "энергия для защиты своих границ. Какие ваши границы нуждаются в защите?",
            "неуверенность": "внимательность и осторожность. Что помогает вам чувствовать себя увереннее?"
        }
        
        for key, reframe in reframes.items():
            if key in limitation.lower():
                return f"А что, если посмотреть на это как на {reframe}"
        
        return "Интересно, как ещё можно назвать это качество? Может, оно несёт в себе что-то полезное?"
    
    def _scale_question(self, topic: str, current: int = None) -> str:
        """Шкалирующий вопрос"""
        if current is None:
            return f"Оцените от 1 до 10, насколько {topic} влияет на вашу жизнь? 1 — совсем не влияет, 10 — очень сильно."
        else:
            return f"Вы оценили на {current}. Что нужно, чтобы подняться на один балл выше? Какой самый маленький шаг можно сделать?"
    
    def _clarify_values(self) -> str:
        """Прояснение ценностей"""
        return "Что для вас сейчас действительно важно в этой ситуации? Какие ценности здесь затронуты?"
    
    def _find_exceptions(self, problem: str) -> str:
        """Поиск исключений"""
        return f"Бывает ли так, что {problem} НЕ происходит? Что тогда по-другому? Что вы делаете в такие моменты?"
    
    def _future_pace(self, goal: str) -> str:
        """Помогает представить будущее"""
        return f"Представьте, что {goal} уже случилось. Закройте глаза на минуту... Что изменилось в вашей жизни? Что вы чувствуете? Что видите вокруг?"
    
    def _generate_philosophical_suggestions(self) -> List[str]:
        """Генерирует философские предложения"""
        suggestions = []
        
        if self.weakest_vector == "СБ":
            suggestions.append("❓ Хотите глубже исследовать природу страха?")
        elif self.weakest_vector == "ТФ":
            suggestions.append("💰 Поговорим о ваших отношениях с ресурсами?")
        elif self.weakest_vector == "УБ":
            suggestions.append("🔍 Может, исследуем, как вы ищете смыслы?")
        elif self.weakest_vector == "ЧВ":
            suggestions.append("🤝 Хотите разобраться в природе доверия?")
        
        suggestions.append("🧠 Какой вопрос для вас сейчас самый важный?")
        suggestions.append("🎯 Что бы вы хотели прояснить в своей жизни?")
        suggestions.append("📖 Интересна ли вам философская цитата для размышления?")
        
        return suggestions[:3]
    
    def get_tools_description(self) -> Dict[str, str]:
        """Возвращает описание доступных инструментов"""
        return {
            "open_questions": "Задаю вопросы, которые помогают прояснить мысли",
            "loop_awareness": "Помогаю заметить повторяющиеся паттерны",
            "reframing": "Предлагаю посмотреть на ситуацию под другим углом",
            "scaling": "Помогаю оценить прогресс от 1 до 10",
            "values_clarification": "Помогаю понять, что для вас действительно важно",
            "exception_finding": "Ищу моменты, когда проблема не проявляется",
            "future_pacing": "Предлагаю представить желаемое будущее",
            "logical_analysis": "Помогаю разобрать ситуацию логически"
        }
