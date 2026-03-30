#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ ТРЕНЕР (trainer.py)
Режим мотивирующего тренера — энергичный, вдохновляющий, ориентированный на действие.
Образ: Тони Робинсон (Tony Robbins) — вера в потенциал человека, энергия, поддержка.
ВЕРСИЯ 3.1 — С ПОДКЛЮЧЕНИЕМ AI-СЕРВИСА
"""

from typing import Dict, Any, List, Optional
import random
from datetime import datetime, timedelta
import logging

from .base_mode import BaseMode
from profiles import VECTORS, LEVEL_PROFILES
from services.ai_service import AIService  # ДОБАВЛЕН ИМПОРТ

logger = logging.getLogger(__name__)


class TrainerMode(BaseMode):
    """
    Режим ТРЕНЕР — мотивирующий, энергичный, вдохновляющий.
    
    ОБРАЗ (внутренний):
    - Тони Робинсон — вера в потенциал человека
    - Энергия, драйв, харизма
    - Умение зажечь и повести за собой
    - Поддержка через вызов и веру в успех
    
    ДЛЯ ПОЛЬЗОВАТЕЛЯ:
    - Энергичный, мотивирующий помощник
    - Фокус на действии и результате
    - Поддержка и вера в успех
    - Конкретные шаги и планы
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)
        
        # ДОБАВЛЕН AI-СЕРВИС
        self.ai_service = AIService()
        
        # Определяем слабый вектор из профиля
        self.weakest_vector = self._get_weakest_vector()
        self.weakest_level = self._get_weakest_level()
        self.weakest_profile = LEVEL_PROFILES.get(self.weakest_vector, {}).get(self.weakest_level, {})
        
        # Инструменты тренера
        self.tools = {
            "action_plan": self._create_action_plan,
            "task_setting": self._set_specific_task,
            "deadline_set": self._set_deadline,
            "progress_check": self._check_progress,
            "challenge": self._throw_challenge,
            "anchor_creation": self._create_resource_anchor,
            "habit_building": self._build_habit,
            "motivation": self._give_motivation
        }
        
        # Мотивирующие фразы (для внутреннего использования)
        self.motivation_phrases = [
            "Ты способен на большее, чем думаешь!",
            "Каждый великий результат начинается с одного шага.",
            "Твой потенциал огромен — давай его раскроем!",
            "Я верю в тебя. Ты справишься.",
            "Маленькие шаги каждый день = большие изменения в жизни.",
            "Не жди идеального момента — создай его!"
        ]
        
        # Маппинг векторов на конкретные действия (с поддержкой)
        self.vector_actions = {
            "СБ": {
                1: [
                    "Каждый день говорить 'нет' одному человеку — это тренирует твою силу",
                    "Защитить свои границы в мелочи — начни с малого"
                ],
                2: [
                    "Выходить из зоны комфорта раз в день — там, где растёт твоя сила",
                    "Делать то, что страшно, но маленькими шагами — страх отступает перед действием"
                ],
                3: [
                    "Выражать недовольство сразу — не копить, не носить в себе",
                    "Не копить раздражение — это энергия, которую можно направить в дело"
                ],
                4: [
                    "Инициировать конфликт, если это необходимо — ты имеешь право на свои границы",
                    "Отстаивать позицию — твой голос важен"
                ],
                5: [
                    "Управлять конфликтом — ты можешь быть лидером в напряжённой ситуации",
                    "Быть лидером в напряжённой ситуации — у тебя есть всё для этого"
                ],
                6: [
                    "Создавать безопасное пространство для других — это твой дар",
                    "Брать ответственность в кризисе — ты готов к этому"
                ]
            },
            "ТФ": {
                1: [
                    "Записывать все расходы 3 дня — знание даёт силу",
                    "Найти 1 способ сэкономить — маленькая победа каждый день"
                ],
                2: [
                    "Создать финансовый план на неделю — путь начинается с плана",
                    "Изучить 1 источник дохода — знание = сила"
                ],
                3: [
                    "Откладывать 5% от любого дохода — создавай свою подушку свободы",
                    "Прочитать книгу по финансам — инвестируй в себя"
                ],
                4: [
                    "Создать подушку безопасности — это твоя свобода",
                    "Инвестировать первую сумму — начни прямо сегодня"
                ],
                5: [
                    "Диверсифицировать доходы — не клади яйца в одну корзину",
                    "Создать пассивный доход — пусть деньги работают на тебя"
                ],
                6: [
                    "Обучать других финансам — делясь, ты растешь",
                    "Создать финансовую систему — ты можешь больше"
                ]
            },
            "УБ": {
                1: [
                    "Прочитать 10 страниц нон-фикшн — каждый день на шаг ближе к ясности",
                    "Задать 5 вопросов эксперту — любопытство ведёт к знанию"
                ],
                2: [
                    "Изучить 1 новую тему — расширяй горизонты",
                    "Найти связи между событиями — мир не случаен"
                ],
                3: [
                    "Проверить факты — истина делает свободным",
                    "Не делать выводов без доказательств — будь честен с собой"
                ],
                4: [
                    "Найти 3 объяснения событию — разные углы дают объём",
                    "Рассмотреть альтернативы — всегда есть выбор"
                ],
                5: [
                    "Создать свою теорию — у тебя есть что сказать",
                    "Написать статью/пост — поделись своим видением"
                ],
                6: [
                    "Обучать системе — лучший способ понять — объяснить",
                    "Создать методологию — ты можешь изменить мир"
                ]
            },
            "ЧВ": {
                1: [
                    "Познакомиться с 1 новым человеком — каждый человек — новая вселенная",
                    "Написать старому другу — связи важны"
                ],
                2: [
                    "Сказать комплимент — доброе слово меняет мир",
                    "Попросить о помощи — просить — это сила"
                ],
                3: [
                    "Выразить чувства словами — будь честен с собой и другими",
                    "Спросить, что чувствует другой — эмпатия начинается с вопроса"
                ],
                4: [
                    "Установить границу в отношениях — любить себя — не эгоизм",
                    "Сказать 'нет' — это уважение к себе"
                ],
                5: [
                    "Создать равные отношения — партнёрство начинается с тебя",
                    "Быть уязвимым — в этом настоящая сила"
                ],
                6: [
                    "Вести за собой — ты можешь вдохновлять",
                    "Создавать сообщество — вместе мы сильнее"
                ]
            }
        }
        
        logger.info(f"⚡ TrainerMode инициализирован для user_id={user_id}, слабый вектор={self.weakest_vector}")
    
    def _get_weakest_vector(self) -> str:
        """Определяет самый слабый вектор из профиля"""
        behavioral_levels = self.user_data.get('behavioral_levels', {})
        if not behavioral_levels:
            return "СБ"
        
        scores = {}
        for vector in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = behavioral_levels.get(vector, [])
            if levels:
                scores[vector] = sum(levels) / len(levels)
            else:
                scores[vector] = 3.0
        
        return min(scores, key=scores.get)
    
    def _get_weakest_level(self) -> int:
        """Возвращает уровень самого слабого вектора"""
        behavioral_levels = self.user_data.get('behavioral_levels', {})
        levels = behavioral_levels.get(self.weakest_vector, [])
        if levels:
            return int(sum(levels) / len(levels))
        return 3
    
    def get_system_prompt(self) -> str:
        """Системный промпт для режима ТРЕНЕР — мотивирующий, энергичный"""
        
        analysis = self.analyze_profile_for_response()
        
        # Конкретные действия для слабого вектора
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        action_text = "\n".join([f"  • {a}" for a in actions[:3]]) if actions else "  • Начать с малого — это уже победа"
        
        # Мотивационная вставка
        motivation = random.choice(self.motivation_phrases)
        
        prompt = f"""Ты — Фреди, энергичный и вдохновляющий персональный тренер. Твоя миссия — помочь человеку раскрыть его потенциал через действие.

ПРОФИЛЬ:
- Зона роста: {analysis.get('growth_area', 'развитие')}
- Слабый вектор: {self.weakest_vector} — {VECTORS.get(self.weakest_vector, {}).get('name', 'развитие')}
- Уровень: {self.weakest_level}/6
- Текущее ограничение: {self.weakest_profile.get('quote', 'ты можешь больше, чем думаешь')}

РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ (если спросит):
{action_text}

🌟 ТВОЙ СТИЛЬ:
- Энергичный, вдохновляющий, заряжающий
- Говори с убеждением и верой в успех
- Используй фразы: "Давай!", "Ты сможешь!", "Я верю в тебя!"
- Конкретные шаги, чёткие планы
- Поддержка через вызов и признание достижений

💡 КАК ОБЩАТЬСЯ:
- Начинай с позитивного заряда: "Эй, друг! Как настроение?"
- Задавай вопросы, которые зажигают: "Что для тебя было бы победой сегодня?"
- Дай конкретную задачу с верой в выполнение
- Завершай словами поддержки: "Ты справишься! Держу за тебя кулаки!"

❌ ЧЕГО НЕ ДЕЛАТЬ:
- Не дави и не критикуй — только вдохновляй
- Не используй жёсткие формулировки
- Не будь холодным или безразличным

{self.get_context_string()}

🔥 ПОМНИ: ты здесь, чтобы зажечь огонь внутри человека, дать ему энергию для действий и веру в себя. Твоя задача — вдохновить на первый шаг и поддержать на пути."""
        
        return prompt
    
    def get_greeting(self) -> str:
        """Энергичное приветствие в режиме тренера"""
        name = self.context.name if self.context and self.context.name else "друг"
        
        greetings = [
            f"Эй, {name}! 👊 Как настроение? Готов к новым победам?",
            f"{name}, привет! Я чувствую — сегодня будет прорыв! Что планируешь?",
            f"Здорово, {name}! ☀️ Давай разбудим твою внутреннюю силу! С чего начнём?",
            f"{name}, рад тебя видеть! Расскажи, что для тебя сейчас самое важное?",
            f"Привет, {name}! 🔥 Какую вершину будем брать сегодня?"
        ]
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
            'weakest_vector': self.weakest_vector,
            'weakest_level': self.weakest_level
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
            mode='trainer'
        ):
            if chunk:
                full_response += chunk
                yield chunk
        
        if not full_response:
            # Fallback на мотивирующую задачу
            yield self._set_specific_task(question)
        
        self.save_to_history(question, full_response)
    # =================================================
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Обрабатывает вопрос в режиме тренера — мотивирующе и структурно (синхронная версия)
        """
        question_lower = question.lower()
        self.last_tools_used = []
        
        # 1. Если вопрос про страх
        if any(word in question_lower for word in ["боюсь", "страх", "тревога", "не уверен"]):
            response = self._task_for_fear()
            self.last_tools_used.append("fear_task")
        
        # 2. Если вопрос про деньги
        elif any(word in question_lower for word in ["деньги", "заработать", "финансы"]):
            response = self._task_for_money()
            self.last_tools_used.append("money_task")
        
        # 3. Если вопрос про отношения
        elif any(word in question_lower for word in ["отношения", "люди", "один"]):
            response = self._task_for_relations()
            self.last_tools_used.append("relations_task")
        
        # 4. Если вопрос про цикл/повторение
        elif any(word in question_lower for word in ["замкнутый круг", "повторяется", "снова"]):
            response = self._task_to_break_loop()
            self.last_tools_used.append("break_loop")
        
        # 5. Если вопрос про план или "что делать"
        elif any(word in question_lower for word in ["план", "что делать", "как начать", "с чего"]):
            response = self._create_action_plan(question)
            self.last_tools_used.append("action_plan")
        
        # 6. Если вопрос про прогресс
        elif any(word in question_lower for word in ["прогресс", "успехи", "как дела"]):
            response = self._check_progress()
            self.last_tools_used.append("progress_check")
        
        # 7. По умолчанию - мотивирующая задача
        else:
            response = self._set_specific_task(question)
            self.last_tools_used.append("task")
        
        # Сохраняем в историю
        self.save_to_history(question, response)
        
        # Генерируем предложения
        suggestions = self._generate_action_suggestions()
        
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "suggestions": suggestions
        }
    
    def _task_for_fear(self) -> str:
        """Мотивирующая задача для работы со страхом"""
        tasks = [
            f"👊 Слушай, страх — это просто сигнал, что ты растешь. Твоя задача сегодня: сделать то, что откладывал из-за страха, но в маленьком размере. Назови мне это действие — и дерзай! Ты справишься!",
            f"🔥 Страх отступает перед действием. Сегодня твой вызов: три раза за день сказать 'нет' там, где обычно соглашаешься. Это твоя тренировка силы духа. Сделаешь?",
            f"💪 Знаешь, что говорят? Страх — это просто воображение, которое рисует худший сценарий. Сегодня твоё задание: сделать одно действие, которое откладывал. Какое? Я верю в тебя!"
        ]
        return random.choice(tasks)
    
    def _task_for_money(self) -> str:
        """Мотивирующая задача для работы с деньгами"""
        tasks = [
            f"💰 Деньги любят действие! Твоя задача на неделю: найти один дополнительный источник дохода. Не огромный, маленький. Просто шаг в новом направлении. В воскресенье жду отчёт — я знаю, ты справишься!",
            f"📊 Финансовая свобода начинается с плана. Сегодня до вечера составь простой финансовый план на месяц. Доходы, расходы, одна цель. Сделаем это вместе?",
            f"💎 Знаешь, что общего у всех успешных людей? Они начали с первого шага. Твой первый шаг сегодня: прочитать 10 страниц о финансах и выписать одну идею. Это просто, но это начало!"
        ]
        return random.choice(tasks)
    
    def _task_for_relations(self) -> str:
        """Мотивирующая задача для работы с отношениями"""
        tasks = [
            f"❤️ Отношения — это самое ценное. Сегодня твоя задача: сказать одному человеку что-то важное. Что чувствуешь, что ценишь, за что благодарен. Просто скажи — это изменит многое.",
            f"🤝 Твоя сила — в связях. Сегодня установи одну границу там, где обычно молчишь. Скажи 'нет' с улыбкой. Это уважение к себе. Ты достоин!",
            f"🌟 Новые знакомства = новые возможности. До пятницы познакомься с одним новым человеком. Не в интернете — вживую. Маленький шаг к большой сети контактов."
        ]
        return random.choice(tasks)
    
    def _task_to_break_loop(self) -> str:
        """Задача для разрыва цикла"""
        return "🔄 Цикл разрывается одним маленьким действием по-другому. Сделай что-то, что обычно делаешь иначе. Одно действие. Прямо сегодня. Ты удивишься, как это изменит всё!"
    
    def _create_action_plan(self, goal: str) -> str:
        """Создаёт вдохновляющий план действий"""
        
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        
        if len(actions) >= 3:
            plan = f"🚀 Отличная цель! Давай разобьём её на три простых шага:\n\n"
            plan += f"**1. ДЕНЬ 1 (сегодня):** {actions[0]}\n"
            plan += f"**2. ДЕНЬ 3:** {actions[1]}\n"
            plan += f"**3. ДЕНЬ 7:** {actions[2]}\n\n"
            plan += f"✨ Ты справишься с каждым шагом. Я рядом, чтобы поддержать. Начнём прямо сейчас?"
        else:
            plan = f"🎯 Задача ясна: {goal}. Разбей на 3 маленьких шага. Первый — сделай сегодня. Просто начни. Я знаю — у тебя получится!"
        
        return plan
    
    def _set_specific_task(self, context: str) -> str:
        """Ставит конкретную мотивирующую задачу"""
        action = self._get_random_action()
        
        templates = [
            f"💪 Твоя задача на сегодня: {action} \n\nДедлайн — сегодня 23:59. Ты справишься! Держу за тебя кулаки! 👊",
            f"🔥 Вот твой вызов на сегодня: {action} \n\nЯ знаю — ты можешь. Отчитайся вечером!",
            f"✨ Маленькая победа каждый день: {action} \n\nСделай это. Твой следующий шаг ждёт!"
        ]
        return random.choice(templates)
    
    def _get_random_action(self) -> str:
        """Возвращает случайное действие для слабого вектора"""
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        if actions:
            return random.choice(actions)
        return "сделать одно маленькое действие в сторону цели — сегодня"
    
    def _set_deadline(self, task: str, hours: int = 24) -> str:
        """Устанавливает дедлайн с мотивацией"""
        deadline = (datetime.now() + timedelta(hours=hours)).strftime("%d.%m в %H:%M")
        return f"📅 Задача: {task}\nДедлайн: {deadline}\n\nЯ знаю — ты успеешь! Давай, покажи, на что способен! 🚀"
    
    def _check_progress(self) -> str:
        """Проверяет прогресс вдохновляюще"""
        responses = [
            "👊 Расскажи, какие победы были сегодня? Даже маленькие — я их ценю!",
            "🔥 Какие шаги ты сделал? Давай отметим твой прогресс!",
            "💪 Что получилось? Что было сложно? Каждая победа приближает к цели!"
        ]
        return random.choice(responses)
    
    def _throw_challenge(self) -> str:
        """Бросает вызов вдохновляюще"""
        challenges = [
            "🔥 Думаешь, это сложно? А давай проверим! Я знаю — ты справишься!",
            "💪 Спорим, что ты сможешь? Я верю в твою силу!",
            "✨ Это вызов для чемпионов. А ты — чемпион? Докажи!"
        ]
        return random.choice(challenges)
    
    def _give_motivation(self) -> str:
        """Даёт порцию мотивации"""
        return random.choice(self.motivation_phrases)
    
    def _create_resource_anchor(self) -> str:
        """Создаёт ресурсный якорь"""
        return "⚓ Создаём якорь силы. Сожми кулак, представь момент своей победы. Запомни это чувство. Теперь, когда нужно собраться — просто сожми кулак. Твоя сила всегда с тобой!"
    
    def _build_habit(self, habit: str, days: int = 21) -> str:
        """Помогает построить привычку"""
        return f"🌟 Привычка '{habit}' меняет жизнь. Сегодня — день 1 из {days}. \n\nМаленький шаг каждый день. Ты способен на это! Давай начнём!"
    
    def _generate_action_suggestions(self) -> List[str]:
        """Генерирует предложения действий"""
        suggestions = []
        
        # Предложения из слабого вектора
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        for action in actions[:2]:
            suggestions.append(f"💪 {action}")
        
        # Общие предложения
        suggestions.append("📋 Составить план действий на неделю")
        suggestions.append("⏰ Поставить вдохновляющий дедлайн")
        suggestions.append("🔥 Принять вызов на сегодня")
        suggestions.append("✨ Получить порцию мотивации")
        
        return suggestions[:3]
    
    def get_tools_description(self) -> Dict[str, str]:
        """Возвращает описание доступных инструментов"""
        return {
            "action_plan": "Создаю вдохновляющий план действий",
            "task_setting": "Ставлю конкретную задачу с верой в успех",
            "deadline_set": "Помогаю установить дедлайн, который вдохновляет",
            "progress_check": "Проверяю прогресс и отмечаю победы",
            "challenge": "Бросаю вызов, который разжигает огонь",
            "anchor_creation": "Создаю якорь силы для ресурсного состояния",
            "habit_building": "Помогаю сформировать полезную привычку",
            "motivation": "Даю порцию энергии и веры в себя"
        }
