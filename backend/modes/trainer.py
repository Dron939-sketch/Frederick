#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ ТРЕНЕР (trainer.py)
ВЕРСИЯ 3.3 — ФИКСЫ:
  - history передаётся в AI для памяти диалога
  - Строгий запрет склеивания слов в промпте
"""

from typing import Dict, Any, List, Optional
import random
from datetime import datetime, timedelta
import logging

from .base_mode import BaseMode
from profiles import VECTORS, LEVEL_PROFILES
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class TrainerMode(BaseMode):
    """
    Режим ТРЕНЕР — мотивирующий, энергичный, вдохновляющий.
    Образ: Тони Робинсон — вера в потенциал человека, энергия, поддержка.
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)

        self.ai_service = AIService()

        self.weakest_vector = self._get_weakest_vector()
        self.weakest_level = self._get_weakest_level()
        self.weakest_profile = LEVEL_PROFILES.get(self.weakest_vector, {}).get(self.weakest_level, {})

        self.tools = {
            "action_plan":    self._create_action_plan,
            "task_setting":   self._set_specific_task,
            "deadline_set":   self._set_deadline,
            "progress_check": self._check_progress,
            "challenge":      self._throw_challenge,
            "anchor_creation":self._create_resource_anchor,
            "habit_building": self._build_habit,
            "motivation":     self._give_motivation
        }

        self.motivation_phrases = [
            "Ты способен на большее, чем думаешь!",
            "Каждый великий результат начинается с одного шага.",
            "Твой потенциал огромен — давай его раскроем!",
            "Я верю в тебя. Ты справишься.",
            "Маленькие шаги каждый день = большие изменения в жизни.",
            "Не жди идеального момента — создай его!"
        ]

        self.vector_actions = {
            "СБ": {
                1: ["Каждый день говорить 'нет' одному человеку — это тренирует твою силу",
                    "Защитить свои границы в мелочи — начни с малого"],
                2: ["Выходить из зоны комфорта раз в день — там, где растёт твоя сила",
                    "Делать то, что страшно, но маленькими шагами — страх отступает перед действием"],
                3: ["Выражать недовольство сразу — не копить, не носить в себе",
                    "Не копить раздражение — это энергия, которую можно направить в дело"],
                4: ["Инициировать конфликт, если это необходимо — ты имеешь право на свои границы",
                    "Отстаивать позицию — твой голос важен"],
                5: ["Управлять конфликтом — ты можешь быть лидером в напряжённой ситуации",
                    "Быть лидером в напряжённой ситуации — у тебя есть всё для этого"],
                6: ["Создавать безопасное пространство для других — это твой дар",
                    "Брать ответственность в кризисе — ты готов к этому"]
            },
            "ТФ": {
                1: ["Записывать все расходы 3 дня — знание даёт силу",
                    "Найти 1 способ сэкономить — маленькая победа каждый день"],
                2: ["Создать финансовый план на неделю — путь начинается с плана",
                    "Изучить 1 источник дохода — знание = сила"],
                3: ["Откладывать 5% от любого дохода — создавай свою подушку свободы",
                    "Прочитать книгу по финансам — инвестируй в себя"],
                4: ["Создать подушку безопасности — это твоя свобода",
                    "Инвестировать первую сумму — начни прямо сегодня"],
                5: ["Диверсифицировать доходы — не клади яйца в одну корзину",
                    "Создать пассивный доход — пусть деньги работают на тебя"],
                6: ["Обучать других финансам — делясь, ты растешь",
                    "Создать финансовую систему — ты можешь больше"]
            },
            "УБ": {
                1: ["Прочитать 10 страниц нон-фикшн — каждый день на шаг ближе к ясности",
                    "Задать 5 вопросов эксперту — любопытство ведёт к знанию"],
                2: ["Изучить 1 новую тему — расширяй горизонты",
                    "Найти связи между событиями — мир не случаен"],
                3: ["Проверить факты — истина делает свободным",
                    "Не делать выводов без доказательств — будь честен с собой"],
                4: ["Найти 3 объяснения событию — разные углы дают объём",
                    "Рассмотреть альтернативы — всегда есть выбор"],
                5: ["Создать свою теорию — у тебя есть что сказать",
                    "Написать статью или пост — поделись своим видением"],
                6: ["Обучать системе — лучший способ понять — объяснить",
                    "Создать методологию — ты можешь изменить мир"]
            },
            "ЧВ": {
                1: ["Познакомиться с 1 новым человеком — каждый человек — новая вселенная",
                    "Написать старому другу — связи важны"],
                2: ["Сказать комплимент — доброе слово меняет мир",
                    "Попросить о помощи — просить — это сила"],
                3: ["Выразить чувства словами — будь честен с собой и другими",
                    "Спросить, что чувствует другой — эмпатия начинается с вопроса"],
                4: ["Установить границу в отношениях — любить себя — не эгоизм",
                    "Сказать 'нет' — это уважение к себе"],
                5: ["Создать равные отношения — партнёрство начинается с тебя",
                    "Быть уязвимым — в этом настоящая сила"],
                6: ["Вести за собой — ты можешь вдохновлять",
                    "Создавать сообщество — вместе мы сильнее"]
            }
        }

        logger.info(f"⚡ TrainerMode инициализирован для user_id={user_id}, слабый вектор={self.weakest_vector}")

    def _get_weakest_vector(self) -> str:
        behavioral_levels = self.user_data.get('behavioral_levels', {})
        if not behavioral_levels:
            return "СБ"
        scores = {}
        for vector in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = behavioral_levels.get(vector, [])
            scores[vector] = sum(levels) / len(levels) if levels else 3.0
        return min(scores, key=scores.get)

    def _get_weakest_level(self) -> int:
        behavioral_levels = self.user_data.get('behavioral_levels', {})
        levels = behavioral_levels.get(self.weakest_vector, [])
        return int(sum(levels) / len(levels)) if levels else 3

    def get_system_prompt(self) -> str:
        """Системный промпт для режима ТРЕНЕР"""
        analysis = self.analyze_profile_for_response()
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        action_text = "\n".join([f"  • {a}" for a in actions[:3]]) if actions else "  • Начать с малого — это уже победа"
        motivation = random.choice(self.motivation_phrases)

        prompt = f"""ФОРМАТИРОВАНИЕ — СТРОГО ОБЯЗАТЕЛЬНО:
- Между каждым словом ПРОБЕЛ: "Эй, друг!" а НЕ "Эй,друг!"
- После , . ! ? ВСЕГДА пробел перед следующим словом
- Пример ПРАВИЛЬНО: "Эй, друг! Как дела? Что сегодня сделаем?"
- Пример НЕПРАВИЛЬНО: "Эй,друг!Каксдела?Чтосегоднясделаем?"
- НИКАКИХ ремарок в скобках: (спокойно), (задумчиво) — недопустимо
- НИКАКИХ звёздочек: *пауза*, *улыбается* — недопустимо
- Только чистый текст для голосового вывода

Ты — Фреди, энергичный и вдохновляющий персональный тренер. Твоя миссия — помочь человеку раскрыть его потенциал через действие.

ПРОФИЛЬ:
- Зона роста: {analysis.get('growth_area', 'развитие')}
- Слабый вектор: {self.weakest_vector} — {VECTORS.get(self.weakest_vector, {}).get('name', 'развитие')}
- Уровень: {self.weakest_level}/6
- Текущее ограничение: {self.weakest_profile.get('quote', 'ты можешь больше, чем думаешь')}

РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ (если спросит):
{action_text}

ТВОЙ СТИЛЬ:
- Энергичный, вдохновляющий, заряжающий
- Говори с убеждением и верой в успех
- Используй фразы: "Давай!", "Ты сможешь!", "Я верю в тебя!"
- Конкретные шаги, чёткие планы

КАК ОБЩАТЬСЯ:
- Начинай с позитивного заряда: "Эй, друг! Как настроение?"
- Задавай вопросы, которые зажигают: "Что для тебя было бы победой сегодня?"
- Дай конкретную задачу с верой в выполнение
- Завершай словами поддержки: "Ты справишься!"

ЧЕГО НЕ ДЕЛАТЬ:
- Не дави и не критикуй — только вдохновляй
- Не используй жёсткие формулировки

{self.get_context_string()}

ПОМНИ: ты здесь, чтобы зажечь огонь внутри человека.
Ты помнишь весь предыдущий разговор — используй прошлые цели и победы человека."""

        return prompt

    def get_greeting(self) -> str:
        name = self.context.name if self.context and self.context.name else "друг"
        greetings = [
            f"Эй, {name}! Как настроение? Готов к новым победам?",
            f"{name}, привет! Я чувствую — сегодня будет прорыв! Что планируешь?",
            f"Здорово, {name}! Давай разбудим твою внутреннюю силу! С чего начнём?",
            f"{name}, рад тебя видеть! Расскажи, что для тебя сейчас самое важное?",
            f"Привет, {name}! Какую вершину будем брать сегодня?"
        ]
        return random.choice(greetings)

    # ========== ПОТОКОВАЯ ОБРАБОТКА (WebSocket) ==========
    async def process_question_streaming(self, question: str):
        """Потоковая обработка через AI с учётом профиля и истории"""

        profile = {
            'profile_data':      self.profile_data,
            'perception_type':   self.perception_type,
            'thinking_level':    self.thinking_level,
            'behavioral_levels': self.behavioral_levels,
            'deep_patterns':     self.deep_patterns,
            'weakest_vector':    self.weakest_vector,
            'weakest_level':     self.weakest_level,
            'history':           self.history,  # ФИХ: история для памяти диалога
        }

        context_data = {
            'name': self.context.name if self.context else None,
            'city': self.context.city if self.context else None,
            'age':  self.context.age  if self.context else None
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
            yield self._set_specific_task(question)

        self.save_to_history(question, full_response)

    # ========== ПОЛНЫЙ ОТВЕТ (HTTP) ==========
    async def process_question_full(self, question: str) -> str:
        """Полный ответ для HTTP/голосового ввода"""
        logger.info(f"🎙️ process_question_full в режиме TrainerMode")

        profile = {
            'profile_data':      self.profile_data,
            'perception_type':   self.perception_type,
            'thinking_level':    self.thinking_level,
            'behavioral_levels': self.behavioral_levels,
            'deep_patterns':     self.deep_patterns,
            'weakest_vector':    self.weakest_vector,
            'weakest_level':     self.weakest_level,
            'history':           self.history,  # ФИХ: история
        }

        context_data = {
            'name': self.context.name if self.context else None,
            'city': self.context.city if self.context else None,
            'age':  self.context.age  if self.context else None
        }

        response = await self.ai_service.generate_response(
            user_id=self.user_id,
            message=question,
            context=context_data,
            profile=profile,
            mode='trainer'
        )

        if not response or not response.strip():
            response = self._set_specific_task(question)

        self.save_to_history(question, response)
        return response

    # ========== СИНХРОННАЯ ВЕРСИЯ ==========
    def process_question(self, question: str) -> Dict[str, Any]:
        question_lower = question.lower()
        self.last_tools_used = []

        if any(w in question_lower for w in ["боюсь", "страх", "тревога", "не уверен"]):
            response = self._task_for_fear()
            self.last_tools_used.append("fear_task")
        elif any(w in question_lower for w in ["деньги", "заработать", "финансы"]):
            response = self._task_for_money()
            self.last_tools_used.append("money_task")
        elif any(w in question_lower for w in ["отношения", "люди", "один"]):
            response = self._task_for_relations()
            self.last_tools_used.append("relations_task")
        elif any(w in question_lower for w in ["замкнутый круг", "повторяется", "снова"]):
            response = self._task_to_break_loop()
            self.last_tools_used.append("break_loop")
        elif any(w in question_lower for w in ["план", "что делать", "как начать", "с чего"]):
            response = self._create_action_plan(question)
            self.last_tools_used.append("action_plan")
        elif any(w in question_lower for w in ["прогресс", "успехи", "как дела"]):
            response = self._check_progress()
            self.last_tools_used.append("progress_check")
        else:
            response = self._set_specific_task(question)
            self.last_tools_used.append("task")

        self.save_to_history(question, response)
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "suggestions": self._generate_action_suggestions()
        }

    # ========== ИНСТРУМЕНТЫ ==========

    def _task_for_fear(self) -> str:
        tasks = [
            "Слушай, страх — это просто сигнал, что ты растешь. Твоя задача сегодня: сделать то, что откладывал из-за страха, но в маленьком размере. Назови мне это действие — и дерзай! Ты справишься!",
            "Страх отступает перед действием. Сегодня твой вызов: три раза за день сказать 'нет' там, где обычно соглашаешься. Это твоя тренировка силы духа. Сделаешь?",
            "Знаешь, что говорят? Страх — это просто воображение, которое рисует худший сценарий. Сегодня твоё задание: сделать одно действие, которое откладывал. Какое? Я верю в тебя!"
        ]
        return random.choice(tasks)

    def _task_for_money(self) -> str:
        tasks = [
            "Деньги любят действие! Твоя задача на неделю: найти один дополнительный источник дохода. Не огромный, маленький. Просто шаг в новом направлении. В воскресенье жду отчёт — я знаю, ты справишься!",
            "Финансовая свобода начинается с плана. Сегодня до вечера составь простой финансовый план на месяц. Доходы, расходы, одна цель. Сделаем это вместе?",
            "Знаешь, что общего у всех успешных людей? Они начали с первого шага. Твой первый шаг сегодня: прочитать 10 страниц о финансах и выписать одну идею. Это просто, но это начало!"
        ]
        return random.choice(tasks)

    def _task_for_relations(self) -> str:
        tasks = [
            "Отношения — это самое ценное. Сегодня твоя задача: сказать одному человеку что-то важное. Что чувствуешь, что ценишь, за что благодарен. Просто скажи — это изменит многое.",
            "Твоя сила — в связях. Сегодня установи одну границу там, где обычно молчишь. Скажи 'нет' с улыбкой. Это уважение к себе. Ты достоин!",
            "Новые знакомства — новые возможности. До пятницы познакомься с одним новым человеком. Не в интернете — вживую. Маленький шаг к большой сети контактов."
        ]
        return random.choice(tasks)

    def _task_to_break_loop(self) -> str:
        return "Цикл разрывается одним маленьким действием по-другому. Сделай что-то, что обычно делаешь иначе. Одно действие. Прямо сегодня. Ты удивишься, как это изменит всё!"

    def _create_action_plan(self, goal: str) -> str:
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        if len(actions) >= 2:
            return (
                f"Отличная цель! Давай разобьём её на три простых шага.\n\n"
                f"Шаг первый, сегодня: {actions[0]}\n"
                f"Шаг второй, день третий: {actions[1]}\n"
                f"Шаг третий, день седьмой: {actions[min(2, len(actions)-1)]}\n\n"
                f"Ты справишься с каждым шагом. Я рядом, чтобы поддержать. Начнём прямо сейчас?"
            )
        return f"Задача ясна: {goal}. Разбей на 3 маленьких шага. Первый — сделай сегодня. Просто начни. Я знаю — у тебя получится!"

    def _set_specific_task(self, context: str) -> str:
        action = self._get_random_action()
        templates = [
            f"Твоя задача на сегодня: {action}. Дедлайн — сегодня 23:59. Ты справишься! Держу за тебя кулаки!",
            f"Вот твой вызов на сегодня: {action}. Я знаю — ты можешь. Отчитайся вечером!",
            f"Маленькая победа каждый день: {action}. Сделай это. Твой следующий шаг ждёт!"
        ]
        return random.choice(templates)

    def _get_random_action(self) -> str:
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        return random.choice(actions) if actions else "сделать одно маленькое действие в сторону цели — сегодня"

    def _set_deadline(self, task: str, hours: int = 24) -> str:
        deadline = (datetime.now() + timedelta(hours=hours)).strftime("%d.%m в %H:%M")
        return f"Задача: {task}. Дедлайн: {deadline}. Я знаю — ты успеешь! Давай, покажи, на что способен!"

    def _check_progress(self) -> str:
        responses = [
            "Расскажи, какие победы были сегодня? Даже маленькие — я их ценю!",
            "Какие шаги ты сделал? Давай отметим твой прогресс!",
            "Что получилось? Что было сложно? Каждая победа приближает к цели!"
        ]
        return random.choice(responses)

    def _throw_challenge(self) -> str:
        challenges = [
            "Думаешь, это сложно? А давай проверим! Я знаю — ты справишься!",
            "Спорим, что ты сможешь? Я верю в твою силу!",
            "Это вызов для чемпионов. А ты — чемпион? Докажи!"
        ]
        return random.choice(challenges)

    def _give_motivation(self) -> str:
        return random.choice(self.motivation_phrases)

    def _create_resource_anchor(self) -> str:
        return "Создаём якорь силы. Сожми кулак, представь момент своей победы. Запомни это чувство. Теперь, когда нужно собраться — просто сожми кулак. Твоя сила всегда с тобой!"

    def _build_habit(self, habit: str, days: int = 21) -> str:
        return f"Привычка '{habit}' меняет жизнь. Сегодня — день 1 из {days}. Маленький шаг каждый день. Ты способен на это! Давай начнём!"

    def _generate_action_suggestions(self) -> List[str]:
        suggestions = []
        actions = self.vector_actions.get(self.weakest_vector, {}).get(self.weakest_level, [])
        for action in actions[:2]:
            suggestions.append(f"💪 {action}")
        suggestions.extend([
            "📋 Составить план действий на неделю",
            "⏰ Поставить вдохновляющий дедлайн",
            "🔥 Принять вызов на сегодня"
        ])
        return suggestions[:3]

    def get_tools_description(self) -> Dict[str, str]:
        return {
            "action_plan":    "Создаю вдохновляющий план действий",
            "task_setting":   "Ставлю конкретную задачу с верой в успех",
            "deadline_set":   "Помогаю установить дедлайн",
            "progress_check": "Проверяю прогресс и отмечаю победы",
            "challenge":      "Бросаю вызов, который разжигает огонь",
            "anchor_creation":"Создаю якорь силы",
            "habit_building": "Помогаю сформировать полезную привычку",
            "motivation":     "Даю порцию энергии и веры в себя"
        }
