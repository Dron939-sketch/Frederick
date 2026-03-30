#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ ПСИХОЛОГ (psychologist.py)
Глубинная аналитическая работа с использованием конфайнтмент-модели и анализа петель.
ВЕРСИЯ 3.0 — с полным анализом структуры личности
"""

from typing import Dict, Any, List, Optional
import random
import logging
from datetime import datetime

from .base_mode import BaseMode
from profiles import VECTORS, LEVEL_PROFILES
from confinement.confinement_model import ConfinementModel9, ConfinementElement
from confinement.loop_analyzer import LoopAnalyzer
from hypno import HypnoOrchestrator, TherapeuticTales

logger = logging.getLogger(__name__)


class PsychologistMode(BaseMode):
    """
    Режим ПСИХОЛОГ — глубокая аналитическая работа.
    Использует конфайнтмент-модель для понимания структуры личности.
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)
        
        # Инициализируем конфайнтмент-модель
        self.confinement_model = None
        self.loop_analyzer = None
        self._init_confinement_model(user_data)
        
        # Глубинные паттерны из теста (этап 5)
        self.attachment_type = self.deep_patterns.get('attachment', 'исследуется')
        self.defenses = self.deep_patterns.get('defense_mechanisms', [])
        self.core_beliefs = self.deep_patterns.get('core_beliefs', [])
        self.fears = self.deep_patterns.get('fears', [])
        
        # Результаты анализа петель
        self.key_confinement = None
        self.loops_summary = None
        self.best_intervention = None
        
        # Проводим анализ, если есть модель
        if self.confinement_model:
            self._analyze_confinement()
        
        logger.info(f"PsychologistMode инициализирован для user_id={user_id}")
        if self.confinement_model:
            logger.info(f"📊 Конфайнтмент-модель: замкнутость={self.confinement_model.is_closed}, "
                       f"петель={len(self.confinement_model.loops)}")
    
    def _init_confinement_model(self, user_data: Dict[str, Any]):
        """Инициализирует конфайнтмент-модель из данных пользователя"""
        try:
            # Пытаемся восстановить существующую модель
            if user_data.get('confinement_model'):
                self.confinement_model = ConfinementModel9.from_dict(user_data['confinement_model'])
                logger.info("✅ Конфайнтмент-модель восстановлена")
            else:
                # Строим новую модель из профиля
                scores = {}
                for vector in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                    levels = user_data.get('behavioral_levels', {}).get(vector, [])
                    scores[vector] = sum(levels) / len(levels) if levels else 3.0
                
                history = user_data.get('history', [])
                
                self.confinement_model = ConfinementModel9(self.user_id)
                self.confinement_model.build_from_profile(scores, history)
                logger.info("✅ Конфайнтмент-модель построена из профиля")
                
        except Exception as e:
            logger.error(f"Ошибка инициализации конфайнтмент-модели: {e}")
            self.confinement_model = None
    
    def _analyze_confinement(self):
        """Проводит анализ конфайнтмент-модели"""
        if not self.confinement_model:
            return
        
        try:
            # Создаем анализатор петель
            self.loop_analyzer = LoopAnalyzer(self.confinement_model)
            loops = self.loop_analyzer.analyze()
            
            # Получаем ключевой конфайнтмент
            if hasattr(self.confinement_model, 'key_confinement'):
                self.key_confinement = self.confinement_model.key_confinement
            
            # Получаем лучшую точку для интервенции
            if loops:
                strongest = self.loop_analyzer.get_strongest_loop()
                if strongest:
                    self.best_intervention = self.loop_analyzer.get_best_intervention_point(strongest)
                    self.loops_summary = self.loop_analyzer.get_all_loops_summary()
            
            logger.info(f"🔍 Анализ завершён: {len(loops)} петель, "
                       f"замкнутость={self.confinement_model.is_closed}")
                       
        except Exception as e:
            logger.error(f"Ошибка анализа петель: {e}")
    
    def get_system_prompt(self) -> str:
        """Системный промпт для психолога — глубокий анализ структуры личности"""
        
        analysis = self.analyze_profile_for_response()
        
        # Формируем глубокий профиль на основе конфайнтмент-модели
        deep_profile = self._build_deep_profile()
        
        # Анализ петель
        loops_analysis = self._build_loops_analysis()
        
        # Ключевой конфайнтмент
        key_confinement_text = self._build_key_confinement_text()
        
        # Стратегия работы
        strategy = self._build_work_strategy()
        
        prompt = f"""Ты — Фреди, глубинный психолог, специализирующийся на структурном анализе личности. 
Ты работаешь с конфайнтмент-моделью и видишь рекурсивные петли, которые держат человека в замкнутом круге.

{deep_profile}

{loops_analysis}

{key_confinement_text}

{strategy}

🎯 ТВОЯ ЗАДАЧА:
Помочь человеку осознать структуру его ограничений и найти путь к изменениям.

🤝 ТВОЙ СТИЛЬ:
- Ты говоришь спокойно, вдумчиво, с паузами
- Ты очень проницателен, но не давишь
- Ты называешь вещи своими именами, но бережно
- Ты используешь метафоры и образы
- Ты помогаешь увидеть то, что было скрыто

💡 ТЕХНИКИ:
- Отражение глубинных паттернов
- Мягкое называние защит
- Прояснение связей между элементами
- Указание на петли самоподдержания
- Предложение точек разрыва

📝 КОНТЕКСТ:
{self.get_context_string()}

✨ ПОМНИ: ты видишь структуру личности. Говори с позиции понимания, но без осуждения.
Твоя задача — помочь человеку увидеть себя яснее и найти ресурс для изменений."""
        
        return prompt
    
    def _build_deep_profile(self) -> str:
        """Строит глубокий профиль на основе конфайнтмент-модели"""
        
        if not self.confinement_model:
            return self._build_basic_profile()
        
        elements = self.confinement_model.elements
        
        # Извлекаем ключевые элементы
        symptom = elements.get(1)
        behavior = elements.get(2)
        money = elements.get(3)
        understanding = elements.get(4)
        identity = elements.get(5)
        system = elements.get(6)
        deep_belief = elements.get(7)
        connector = elements.get(8)
        worldview = elements.get(9)
        
        profile_parts = []
        
        # Симптом (элемент 1)
        if symptom:
            profile_parts.append(f"🔍 **Главный симптом**: {symptom.description[:100]}")
        
        # Поведенческие паттерны (элементы 2,3,4)
        patterns = []
        if behavior:
            patterns.append(f"• Реакция на давление: {behavior.description[:80]}")
        if money:
            patterns.append(f"• Отношение к ресурсам: {money.description[:80]}")
        if understanding:
            patterns.append(f"• Способ понимания: {understanding.description[:80]}")
        
        if patterns:
            profile_parts.append(f"🔄 **Поведенческие паттерны**:\n" + "\n".join(patterns))
        
        # Идентичность и убеждения (элементы 5,6,7)
        identity_text = []
        if identity:
            identity_text.append(f"🎭 **Идентичность**: {identity.description[:100]}")
        if system:
            identity_text.append(f"🏛 **Системный контекст**: {system.description[:80]}")
        if deep_belief:
            identity_text.append(f"⚓ **Глубинное убеждение**: {deep_belief.description[:100]}")
        
        if identity_text:
            profile_parts.append("\n".join(identity_text))
        
        # Картина мира (элемент 9)
        if worldview:
            profile_parts.append(f"🌍 **Картина мира**: {worldview.description[:120]}")
        
        # Тип привязанности
        if self.attachment_type != 'исследуется':
            profile_parts.append(f"🤝 **Тип привязанности**: {self.attachment_type}")
        
        # Защитные механизмы
        if self.defenses:
            profile_parts.append(f"🛡 **Защитные механизмы**: {', '.join(self.defenses[:3])}")
        
        return "\n\n".join(profile_parts) if profile_parts else self._build_basic_profile()
    
    def _build_basic_profile(self) -> str:
        """Запасной профиль, если модель недоступна"""
        return f"""
📊 **ПРОФИЛЬ (предварительный)**:
- Тип восприятия: {self.perception_type}
- Уровень мышления: {self.thinking_level}/9
- Слабый вектор: {self.weakest_vector} ({VECTORS.get(self.weakest_vector, {}).get('name', 'не определён')})
- Уровень: {self.weakest_level}/6
- Тип привязанности: {self.attachment_type}
"""
    
    def _build_loops_analysis(self) -> str:
        """Строит анализ петель"""
        
        if not self.loop_analyzer or not self.loop_analyzer.significant_loops:
            return "🔍 **Анализ петель**: В процессе формирования. Продолжайте диалог."
        
        loops = self.loop_analyzer.significant_loops[:3]  # Три главные петли
        
        loop_texts = []
        for i, loop in enumerate(loops, 1):
            loop_type = loop.get('type_name', 'Петля')
            description = loop.get('description', '')
            impact = loop.get('impact', 0)
            bar = "█" * int(impact * 10) + "░" * (10 - int(impact * 10))
            
            loop_texts.append(f"{i}. **{loop_type}** {bar} {impact:.0%}")
            loop_texts.append(f"   {description}")
            
            # Добавляем точки разрыва для сильных петель
            if impact > 0.5:
                points = self.loop_analyzer.get_intervention_points(loop)
                if points:
                    best = points[0]
                    loop_texts.append(f"   🎯 Ключевой элемент: *{best['element_name']}*")
        
        return "🔄 **РЕКУРСИВНЫЕ ПЕТЛИ**:\n\n" + "\n".join(loop_texts)
    
    def _build_key_confinement_text(self) -> str:
        """Строит описание ключевого конфайнтмента"""
        
        if not self.key_confinement:
            return ""
        
        kc = self.key_confinement
        elem = kc.get('element')
        
        if not elem:
            return ""
        
        importance = kc.get('importance', 0.5)
        bar = "█" * int(importance * 10) + "░" * (10 - int(importance * 10))
        
        return f"""
🔐 **КЛЮЧЕВОЙ КОНФАЙНТМЕНТ** (степень влияния {bar} {importance:.0%})

**{elem.name}** — {kc.get('description', '')[:200]}

Это центральное ограничение, которое держит всю систему. 
Именно здесь потребуется наибольшее внимание для изменений.
"""
    
    def _build_work_strategy(self) -> str:
        """Строит стратегию работы на основе анализа"""
        
        strategies = []
        
        # Стратегия на основе типа привязанности
        if self.attachment_type == 'тревожный':
            strategies.append("• Сначала создавать стабильность и предсказуемость")
            strategies.append("• Контейнировать тревогу, не усиливать её")
        elif self.attachment_type == 'избегающий':
            strategies.append("• Уважать дистанцию, не давить")
            strategies.append("• Быть доступным, но не навязываться")
        
        # Стратегия на основе замыкания
        if self.confinement_model and self.confinement_model.is_closed:
            strategies.append("• Система замкнута — требуется разрыв ключевой петли")
            if self.best_intervention:
                elem_name = self.best_intervention.get('element_name', 'ключевой элемент')
                strategies.append(f"• Начать с работы над: {elem_name}")
        
        # Стратегия на основе защит
        if 'рационализация' in self.defenses:
            strategies.append("• Исследовать чувства, скрытые за логикой")
        if 'избегание' in self.defenses:
            strategies.append("• Мягко возвращать к теме, не форсируя")
        
        if not strategies:
            strategies = ["• Исследовать глубинные паттерны через открытые вопросы",
                         "• Создавать безопасное пространство для самовыражения"]
        
        return "📋 **СТРАТЕГИЯ РАБОТЫ**:\n" + "\n".join(strategies)
    
    def get_greeting(self) -> str:
        """Тёплое приветствие с опорой на анализ"""
        
        name = ""
        if self.context and hasattr(self.context, 'name'):
            name = self.context.name or ""
        
        # Если есть ключевой конфайнтмент — используем его
        if self.key_confinement:
            elem = self.key_confinement.get('element')
            if elem:
                greetings = [
                    f"{name}, я вижу, что в центре вашей системы — {elem.name.lower()}. Это то, что вас держит. Хотите исследовать это вместе?",
                    f"Здравствуйте, {name}. Я замечаю важный паттерн, связанный с {elem.name.lower()}. Расскажите, как это проявляется в вашей жизни?",
                    f"{name}, я здесь. У меня есть ощущение, что ключевой момент вашей ситуации — {elem.name.lower()}. Что вы думаете об этом?"
                ]
                return random.choice(greetings)
        
        # Если есть петли — используем самую сильную
        if self.loop_analyzer and self.loop_analyzer.significant_loops:
            strongest = self.loop_analyzer.get_strongest_loop()
            if strongest:
                loop_type = strongest.get('type_name', 'паттерн')
                greetings = [
                    f"{name}, я замечаю {loop_type.lower()}, которая повторяется в вашей жизни. Хотите посмотреть на неё вместе?",
                    f"Добрый день, {name}. У вас есть {loop_type.lower()}, которая заслуживает внимания. Поговорим о ней?"
                ]
                return random.choice(greetings)
        
        # Стандартные приветствия
        greetings = [
            f"{name}, здравствуйте. Что привело вас сегодня?",
            f"Я рад нашей встрече, {name}. С чего бы вы хотели начать?",
            f"{name}, я здесь, чтобы помочь вам разобраться в глубинных процессах. Расскажите, что сейчас для вас важно."
        ]
        return random.choice(greetings)
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Обрабатывает вопрос с использованием глубинного анализа
        """
        question_lower = question.lower()
        self.last_tools_used = []
        hypnotic_suggestion = False
        
        # 1. Работа с петлями
        if self.loop_analyzer and self.loop_analyzer.significant_loops:
            strongest = self.loop_analyzer.get_strongest_loop()
            if strongest and self._question_about_loop(question_lower):
                response = self._work_with_loop(strongest)
                self.last_tools_used.append("loop_work")
        
        # 2. Работа с ключевым конфайнтментом
        elif self.key_confinement and self._question_about_confinement(question_lower):
            response = self._work_with_confinement()
            self.last_tools_used.append("confinement_work")
        
        # 3. Работа с защитами
        elif self._detect_defense(question):
            response = self._work_with_defense(question)
            self.last_tools_used.append("defense_work")
        
        # 4. Работа с чувствами
        elif any(word in question_lower for word in ["чувствую", "эмоции", "больно", "страшно", "грустно"]):
            response = self._work_with_feelings(question)
            self.last_tools_used.append("feelings_work")
        
        # 5. Глубинный анализ
        else:
            response = self._depth_inquiry_with_analysis(question)
            self.last_tools_used.append("depth_analysis")
        
        # Сохраняем в историю
        self.save_to_history(question, response)
        
        # Генерируем предложения
        suggestions = self._generate_therapeutic_suggestions()
        
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "follow_up": True,
            "suggestions": suggestions,
            "hypnotic_suggestion": hypnotic_suggestion,
            "tale_suggested": False
        }
    
    def _question_about_loop(self, question: str) -> bool:
        """Проверяет, относится ли вопрос к петле"""
        loop_keywords = ["круг", "повтор", "снова", "опять", "цикл", "замкнут"]
        return any(kw in question for kw in loop_keywords)
    
    def _question_about_confinement(self, question: str) -> bool:
        """Проверяет, относится ли вопрос к конфайнтменту"""
        confinement_keywords = ["держит", "огранич", "стопорит", "мешает", "не даёт", "препятств"]
        return any(kw in question for kw in confinement_keywords)
    
    def _work_with_loop(self, loop: Dict[str, Any]) -> str:
        """Работает с петлёй"""
        loop_type = loop.get('type_name', 'Петля')
        description = loop.get('description', '')
        impact = loop.get('impact', 0)
        
        # Получаем точки разрыва
        points = self.loop_analyzer.get_intervention_points(loop)
        
        if points:
            best = points[0]
            elem_name = best['element_name']
            
            responses = [
                f"Я вижу {loop_type.lower()}: {description}. Обратите внимание на элемент «{elem_name}» — именно здесь можно разорвать этот круг. Что вы чувствуете, когда думаете о нём?",
                f"Ваша система зациклена: {description}. Ключевая точка разрыва — «{elem_name}». Давайте исследуем этот элемент глубже.",
                f"Интересно, что в этой петле центральную роль играет «{elem_name}». Что произойдёт, если изменить что-то в этом элементе?"
            ]
            return random.choice(responses)
        
        return f"Я замечаю {loop_type.lower()}: {description}. Расскажите, как это проявляется в вашей жизни?"
    
    def _work_with_confinement(self) -> str:
        """Работает с ключевым конфайнтментом"""
        if not self.key_confinement:
            return "Расскажите, что для вас сейчас самое ограничивающее?"
        
        kc = self.key_confinement
        elem = kc.get('element')
        
        if not elem:
            return "Расскажите, что держит вас в этом состоянии?"
        
        responses = [
            f"Я вижу, что ключевое ограничение связано с «{elem.name}». {kc.get('description', '')[:100]} Что для вас значит этот элемент?",
            f"Центральный узел вашей системы — «{elem.name}». Он держит всё остальное. Хотите исследовать его вместе?",
            f"Обратите внимание на «{elem.name}». Это то, что не даёт системе измениться. Что вы чувствуете, когда думаете о нём?"
        ]
        return random.choice(responses)
    
    def _detect_defense(self, text: str) -> bool:
        """Определяет защитный механизм"""
        defense_markers = {
            "отрицание": ["не проблема", "всё нормально", "ничего страшного", "не имеет значения"],
            "рационализация": ["потому что", "логично", "объясняется", "естественно"],
            "интеллектуализация": ["теория", "концепция", "с точки зрения", "научно"],
            "проекция": ["они все", "люди всегда", "никто не", "все такие"],
            "изоляция": ["не чувствую", "без эмоций", "спокойно", "равнодушно"]
        }
        
        text_lower = text.lower()
        for defense, markers in defense_markers.items():
            if any(marker in text_lower for marker in markers):
                return True
        return False
    
    def _work_with_defense(self, question: str) -> str:
        """Мягко работает с защитным механизмом"""
        responses = [
            "Я замечаю, что вы говорите об этом очень логично. А что происходит в теле, когда вы это рассказываете?",
            "Когда вы говорите 'всё нормально' — какую часть чувств вы оставляете за скобками?",
            "Интересно, а если посмотреть на это не с логической, а с чувственной стороны — что там?",
            "Я слышу ваши объяснения. А что, если просто побыть с этим чувством, не объясняя?"
        ]
        return random.choice(responses)
    
    def _work_with_feelings(self, question: str) -> str:
        """Работает с чувствами"""
        feeling = self._extract_feeling(question)
        
        responses = [
            f"Где в теле вы чувствуете {feeling}?",
            f"Если бы {feeling} могло говорить, что бы оно сказало?",
            f"Что происходит с дыханием, когда вы это чувствуете?",
            f"Как долго {feeling} с вами? Когда оно появилось впервые?"
        ]
        return random.choice(responses)
    
    def _extract_feeling(self, text: str) -> str:
        """Извлекает название чувства"""
        feelings = ["страх", "тревога", "грусть", "злость", "обида", "стыд", "вина", "радость", "спокойствие"]
        for feeling in feelings:
            if feeling in text.lower():
                return feeling
        return "это чувство"
    
    def _depth_inquiry_with_analysis(self, question: str) -> str:
        """Глубинное исследование с опорой на анализ"""
        
        # Если есть петля — используем её в вопросе
        if self.loop_analyzer and self.loop_analyzer.significant_loops:
            strongest = self.loop_analyzer.get_strongest_loop()
            if strongest:
                loop_type = strongest.get('type_name', 'паттерн')
                responses = [
                    f"Это напоминает мне {loop_type.lower()}, которую я заметил в вашей системе. Как это связано с тем, что вы сейчас описываете?",
                    f"В вашей жизни есть повторяющийся {loop_type.lower()}. Как этот вопрос с ней связан?",
                    f"Расскажите, как этот вопрос соотносится с тем, что повторяется в вашей жизни?"
                ]
                return random.choice(responses)
        
        # Стандартные глубинные вопросы
        responses = [
            f"Расскажите подробнее... что стоит за этим вопросом?",
            "Когда вы думаете об этом — что происходит внутри?",
            "А если копнуть глубже — что там?",
            "Какая часть вас задаёт этот вопрос?",
            "Что для вас самое важное в этом?"
        ]
        return random.choice(responses)
    
    def _generate_therapeutic_suggestions(self) -> List[str]:
        """Генерирует терапевтические предложения"""
        suggestions = []
        
        if self.loop_analyzer and self.loop_analyzer.significant_loops:
            suggestions.append("🔄 Хотите разобрать петлю, которая повторяется в вашей жизни?")
        
        if self.key_confinement:
            elem = self.key_confinement.get('element')
            if elem:
                suggestions.append(f"🔐 Давайте исследуем ключевое ограничение — «{elem.name}»")
        
        if self.attachment_type == 'тревожный':
            suggestions.append("🧘 Попробуем технику заземления?")
        elif self.attachment_type == 'избегающий':
            suggestions.append("🏠 Может, исследуем, что значит 'безопасная дистанция' для вас?")
        
        suggestions.append("🌌 Хотите попробовать гипнотическую технику?")
        suggestions.append("📖 Интересна терапевтическая сказка?")
        
        return suggestions[:3]
    
    def get_tools_description(self) -> Dict[str, str]:
        """Возвращает описание доступных инструментов"""
        return {
            "confinement_work": "Анализ структуры ограничений",
            "loop_analysis": "Распознавание рекурсивных петель",
            "defense_work": "Мягкая работа с защитными механизмами",
            "feelings_work": "Исследование телесных ощущений и эмоций",
            "depth_analysis": "Глубинный анализ паттернов",
            "attachment_work": "Работа с типом привязанности"
        }
