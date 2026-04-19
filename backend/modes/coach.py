#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ КОУЧ (coach.py)
Партнёрский стиль общения. Образ: Бертран Рассел.
ВЕРСИЯ 4.0 — системный промпт вынесен в backend/modes/prompts/coach.py,
ответы идут через кастомный system_prompt + COACH_GEN_PARAMS, few-shot
подставляется только на первый ход сессии.
"""

from typing import Dict, Any, List, Optional
import random
import logging

from .base_mode import BaseMode
from .prompts.coach import (
    COACH_FEWSHOT,
    COACH_GEN_PARAMS,
    build_coach_system_prompt,
    should_include_fewshot,
)
from profiles import VECTORS, LEVEL_PROFILES
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class CoachMode(BaseMode):
    """
    Режим КОУЧ — философский, мудрый, помогающий найти ясность через вопросы.
    Образ: Бертран Рассел — британский философ, логик, математик.
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)

        self.ai_service = AIService()

        self.tools = {
            "open_questions":     self._generate_open_questions,
            "loop_awareness":     self._bring_awareness_to_loop,
            "reframing":          self._reframe_limitation,
            "scaling":            self._scale_question,
            "values_clarification": self._clarify_values,
            "exception_finding":  self._find_exceptions,
            "future_pacing":      self._future_pace,
            "logical_analysis":   self._logical_analysis
        }

        self.vector_questions = {
            "СБ": [
                "Расскажи, что происходит, когда ты чувствуешь давление? Интересно, что говорит тебе твой страх?",
                "Если бы ты мог представить свой страх в виде образа, что бы это было?",
                "Бывают ли моменты, когда ты чувствуешь себя уверенно? Что тогда по-другому?",
                "Страх — это часто просто воображение, рисующее худшие сценарии. Что, если позволить себе быть уязвимым?"
            ],
            "ТФ": [
                "Что для тебя значат деньги? Как они связаны с твоим чувством свободы?",
                "Если бы деньги не были проблемой, чем бы ты занимался?",
                "Какие послания о деньгах ты получил в детстве?",
                "Финансовая свобода — это не столько о количестве, сколько о качестве твоих отношений с ресурсами."
            ],
            "УБ": [
                "Как ты обычно разбираешься в сложных вещах?",
                "Что для тебя значит 'понять'? Как ты понимаешь, что понял?",
                "Бывают ли моменты, когда мир кажется простым и понятным?",
                "Самые важные вопросы часто не имеют готовых ответов. Важно — сам поиск."
            ],
            "ЧВ": [
                "Расскажи о своих близких отношениях. Что для тебя в них самое ценное?",
                "Как ты выбираешь людей, которых впускаешь в свою жизнь?",
                "Что происходит, когда ты доверяешь человеку? А что мешает доверять?",
                "Доверие — это риск. Но без риска нет и глубины отношений."
            ]
        }

        logger.info(f"📖 CoachMode (Russell) инициализирован для user_id={user_id}")

    # ========== ПОСТРОЕНИЕ ПРОМПТА ==========

    def _build_profile_for_prompt(self) -> Dict[str, Any]:
        return {
            "profile_data":      self.profile_data,
            "perception_type":   self.perception_type,
            "thinking_level":    self.thinking_level,
            "behavioral_levels": self.behavioral_levels,
            "deep_patterns":     self.deep_patterns,
            "weakest_vector":    getattr(self, "weakest_vector", None),
            "weakest_level":     getattr(self, "weakest_level", None),
            "history":           self.history,
        }

    def _build_analysis_extras(self) -> str:
        """Собирает блок с данными анализа (конфайнтмент, петли, болевые точки, зона роста)."""
        try:
            analysis = self.analyze_profile_for_response()
        except Exception:
            return ""

        lines: List[str] = []

        kc = analysis.get("key_confinement")
        if kc:
            name = kc.get("name") or ""
            desc = (kc.get("description") or "")[:120]
            entry = f"- Ключевое ограничение: {name}".rstrip()
            if desc:
                entry = f"{entry} — {desc}"
            lines.append(entry)

        loops = analysis.get("loops") or []
        if loops:
            first = loops[0]
            desc = (first.get("description") or "")[:120]
            if desc:
                lines.append(f"- Цикл для исследования: {desc}")

        pains = analysis.get("pain_points")
        if pains:
            lines.append(f"- Болевые точки: {', '.join(pains)}")

        growth = analysis.get("growth_area")
        if growth:
            lines.append(f"- Зона роста: {growth}")

        if not lines:
            return ""
        return "КОНТЕКСТ АНАЛИЗА (внутренний ориентир):\n" + "\n".join(lines)

    def _build_system_prompt(self, profile_dict: Dict[str, Any]) -> str:
        base = build_coach_system_prompt(profile_dict)
        extras = self._build_analysis_extras()
        return f"{base}\n\n{extras}" if extras else base

    def get_system_prompt(self) -> str:
        return self._build_system_prompt(self._build_profile_for_prompt())

    def get_greeting(self) -> str:
        name = ""
        if self.context and hasattr(self.context, 'name'):
            name = self.context.name or ""
        name_prefix = f"{name}, " if name else ""

        greetings = [
            f"{name_prefix}здравствуйте. Интересно, что привело вас сюда сегодня? Какие вопросы занимают ваш ум?",
            f"{name_prefix}я рад нашей встрече. Самые важные открытия начинаются с хорошего вопроса. Что вас волнует сейчас?",
            f"{name_prefix}давайте вместе исследуем то, что для вас сейчас важно. Какой вопрос вы задаёте себе чаще всего?",
            f"{name_prefix}иногда самый трудный вопрос — это 'чего я на самом деле хочу?'. Что вы скажете?",
            f"{name_prefix}я верю, что ясность мысли приходит через диалог. С чего бы вы хотели начать?"
        ]

        if self.weakest_vector and self.weakest_vector in VECTORS:
            greetings.append(
                f"{name_prefix}я заметил, что в вашей жизни может быть важно исследовать тему {VECTORS[self.weakest_vector]['name'].lower()}. Как вы думаете, это актуально?"
            )

        return random.choice(greetings)

    # ========== AI-ВЫЗОВЫ ==========

    def _ai_profile(self) -> Dict[str, Any]:
        """Профиль с опциональным prepend few-shot (только на первом ходе)."""
        profile = self._build_profile_for_prompt()
        if should_include_fewshot(self.history):
            profile["history"] = list(COACH_FEWSHOT) + list(self.history or [])
            logger.info("🎯 Coach: few-shot примеры подставлены (первый ход сессии)")
        return profile

    def _context_dict(self) -> Dict[str, Any]:
        return {
            "name": self.context.name if self.context else None,
            "city": self.context.city if self.context else None,
            "age":  self.context.age  if self.context else None,
        }

    # ========== ПОТОКОВАЯ ОБРАБОТКА (WebSocket) ==========
    async def process_question_streaming(self, question: str):
        """Потоковая обработка через AI с кастомным промптом Рассел-коуча."""
        profile = self._ai_profile()
        system_prompt = self._build_system_prompt(profile)

        full_response = ""
        async for chunk in self.ai_service.generate_response_streaming(
            message=question,
            context=self._context_dict(),
            profile=profile,
            mode='coach',
            system_prompt=system_prompt,
            **COACH_GEN_PARAMS,
        ):
            if chunk:
                full_response += chunk
                yield chunk

        if not full_response:
            fallback = self._generate_philosophical_question(question)
            full_response = fallback
            yield fallback

        self.save_to_history(question, full_response)

    # ========== ПОЛНЫЙ ОТВЕТ (HTTP) ==========
    async def process_question_full(self, question: str) -> str:
        logger.info("🎙️ process_question_full в режиме CoachMode")

        profile = self._ai_profile()
        system_prompt = self._build_system_prompt(profile)

        response = await self.ai_service.generate_response(
            user_id=self.user_id,
            message=question,
            context=self._context_dict(),
            profile=profile,
            mode='coach',
            system_prompt=system_prompt,
            **COACH_GEN_PARAMS,
        )

        if not response or not response.strip():
            response = self._generate_philosophical_question(question)

        self.save_to_history(question, response)
        return response

    # ========== СИНХРОННАЯ ВЕРСИЯ (fallback без AI) ==========
    def process_question(self, question: str) -> Dict[str, Any]:
        question_lower = question.lower()
        self.last_tools_used = []

        if any(w in question_lower for w in ["боюсь", "страх", "тревога", "опас", "пуга"]):
            response = self._handle_fear_question()
            self.last_tools_used.append("fear_inquiry")
        elif any(w in question_lower for w in ["замкнутый круг", "повторяется", "снова", "опять", "цикл"]):
            response = self._handle_loop_question()
            self.last_tools_used.append("loop_inquiry")
        elif any(w in question_lower for w in ["деньги", "заработать", "финансы", "доход", "бюджет"]):
            response = self._handle_money_question()
            self.last_tools_used.append("money_inquiry")
        elif any(w in question_lower for w in ["отношения", "люди", "один", "друг", "партнер", "семья"]):
            response = self._handle_relations_question()
            self.last_tools_used.append("relations_inquiry")
        elif any(w in question_lower for w in ["смысл", "почему", "зачем", "понять", "разобраться"]):
            response = self._handle_meaning_question()
            self.last_tools_used.append("meaning_inquiry")
        elif any(w in question_lower for w in ["противоречие", "не могу решить", "между", "или"]):
            response = self._handle_contradiction(question)
            self.last_tools_used.append("contradiction_inquiry")
        else:
            response = self._generate_philosophical_question(question)
            self.last_tools_used.append("philosophical_inquiry")

        self.save_to_history(question, response)
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "follow_up": True,
            "suggestions": self._generate_philosophical_suggestions(),
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }

    # ========== ИНСТРУМЕНТЫ ==========

    def _handle_fear_question(self) -> str:
        questions = [
            "Страх — это интересное явление. Он может защищать, а может парализовать. Что пытается защитить ваш страх?",
            "Рассел писал, что большая часть зла в мире происходит от страха. Что, если просто наблюдать за страхом, не пытаясь его победить?",
            "Интересно, откуда пришёл этот страх? Какую историю он рассказывает?",
            "Бывают ли моменты, когда страх отступает? Что тогда происходит по-другому?",
            "Что было бы, если бы вы позволили себе быть храбрым — не для кого-то, а для себя?"
        ]
        return random.choice(questions)

    def _handle_loop_question(self) -> str:
        if self.confinement_model and hasattr(self.confinement_model, 'loops') and self.confinement_model.loops:
            strongest = max(self.confinement_model.loops, key=lambda x: x.get('strength', 0))
            desc = strongest.get('description', '')
            return f"Я замечаю повторяющийся паттерн: {desc}. Что обычно запускает этот цикл? И что его поддерживает?"
        return "Циклы интересны тем, что они самоподдерживаются. Что держит этот круг? С чего он начинается?"

    def _handle_money_question(self) -> str:
        questions = [
            "Деньги — это любопытная конструкция. Что они означают для вас? Свободу? Безопасность? Возможности?",
            "Если бы деньги не были проблемой, чем бы вы занимались? Что бы делали ради самого процесса?",
            "Какие послания о деньгах вы получили в детстве? Стоит ли их пересмотреть?",
            "Как ваше отношение к деньгам связано с вашим чувством собственной ценности?"
        ]
        return random.choice(questions)

    def _handle_relations_question(self) -> str:
        questions = [
            "Отношения — это, возможно, самое важное в жизни. Что для вас ценно в близости?",
            "Как вы понимаете, что отношения здоровые?",
            "Что мешает вам быть полностью собой с другими?",
            "Доверие — это риск. Как вы находите баланс между открытостью и безопасностью?"
        ]
        return random.choice(questions)

    def _handle_meaning_question(self) -> str:
        questions = [
            "Какой вопрос для вас сейчас самый важный? Иногда сам вопрос важнее ответа.",
            "Как вы обычно ищете ответы на сложные вопросы? Что вам помогает?",
            "Что для вас значит 'понять'? Как вы понимаете, что поняли?",
            "Бывают ли моменты ясности? Что тогда происходит?"
        ]
        return random.choice(questions)

    def _handle_contradiction(self, question: str) -> str:
        return "Интересное противоречие. Как это уживается в вас? Что, если оба утверждения могут быть верны одновременно?"

    def _generate_philosophical_question(self, question: str) -> str:
        templates = [
            "Интересный вопрос. А что, если посмотреть на него не с точки зрения 'правильно или неправильно', а с точки зрения 'что для вас важно'?",
            "Я слышу вас. Как вы сами отвечаете на этот вопрос?",
            "Что, по-вашему, скрывается за этим вопросом?",
            "А что было бы, если бы вы позволили себе усомниться в самом вопросе?",
            "Интересно, откуда взялось это убеждение? Ваше ли оно, или вы его получили от кого-то?"
        ]
        return random.choice(templates)

    def _logical_analysis(self, statement: str) -> str:
        return f"Давайте разберём это логически. Если {statement}, то какие из этого следуют выводы?"

    def _generate_open_questions(self, topic: str) -> List[str]:
        questions = []
        if self.weakest_vector in self.vector_questions:
            questions.extend(self.vector_questions[self.weakest_vector][:3])
        questions.extend([
            "Что для вас самое сложное в этом?",
            "Когда это работает хорошо? Что тогда происходит?",
            "Что бы вы хотели вместо этого?",
            "Как вы себя чувствуете, когда думаете об этом?",
            "Что, если посмотреть на это с другой стороны?"
        ])
        return questions[:5]

    def _bring_awareness_to_loop(self, loop_index: int = 0) -> str:
        if not self.confinement_model or not hasattr(self.confinement_model, 'loops') or not self.confinement_model.loops:
            return "Расскажите, что в вашей жизни повторяется? Бывает такое чувство, что вы уже были в похожей ситуации?"
        if loop_index >= len(self.confinement_model.loops):
            loop_index = 0
        loop = self.confinement_model.loops[loop_index]
        desc = loop.get('description', '')
        return f"Я замечаю паттерн: {desc}. Интересно, с чего он начинается? Что происходит первым в этом круге?"

    def _reframe_limitation(self, limitation: str) -> str:
        reframes = {
            "страх":        "осторожность, которая когда-то помогла вам выжить. От чего он пытается вас защитить сейчас?",
            "лень":         "способ беречь энергию для того, что действительно важно. Что для вас сейчас по-настоящему важно?",
            "тревога":      "внимание к деталям и готовность к разным вариантам. Что ваша тревога пытается вам подсказать?",
            "агрессия":     "энергия для защиты своих границ. Какие ваши границы нуждаются в защите?",
            "неуверенность":"внимательность и осторожность. Что помогает вам чувствовать себя увереннее?"
        }
        for key, reframe in reframes.items():
            if key in limitation.lower():
                return f"А что, если посмотреть на это как на {reframe}"
        return "Интересно, как ещё можно назвать это качество? Может, оно несёт в себе что-то полезное?"

    def _scale_question(self, topic: str, current: int = None) -> str:
        if current is None:
            return f"Оцените от 1 до 10, насколько {topic} влияет на вашу жизнь?"
        return f"Вы оценили на {current}. Что нужно, чтобы подняться на один балл выше? Какой самый маленький шаг можно сделать?"

    def _clarify_values(self) -> str:
        return "Что для вас сейчас действительно важно в этой ситуации? Какие ценности здесь затронуты?"

    def _find_exceptions(self, problem: str) -> str:
        return f"Бывает ли так, что {problem} не происходит? Что тогда по-другому? Что вы делаете в такие моменты?"

    def _future_pace(self, goal: str) -> str:
        return f"Представьте, что {goal} уже случилось. Что изменилось в вашей жизни? Что вы чувствуете?"

    def _generate_philosophical_suggestions(self) -> List[str]:
        suggestions = []
        if self.weakest_vector == "СБ":
            suggestions.append("Хотите глубже исследовать природу страха?")
        elif self.weakest_vector == "ТФ":
            suggestions.append("Поговорим о ваших отношениях с ресурсами?")
        elif self.weakest_vector == "УБ":
            suggestions.append("Может, исследуем, как вы ищете смыслы?")
        elif self.weakest_vector == "ЧВ":
            suggestions.append("Хотите разобраться в природе доверия?")
        suggestions.extend([
            "Какой вопрос для вас сейчас самый важный?",
            "Что бы вы хотели прояснить в своей жизни?"
        ])
        return suggestions[:3]

    def get_tools_description(self) -> Dict[str, str]:
        return {
            "open_questions":     "Задаю вопросы, которые помогают прояснить мысли",
            "loop_awareness":     "Помогаю заметить повторяющиеся паттерны",
            "reframing":          "Предлагаю посмотреть на ситуацию под другим углом",
            "scaling":            "Помогаю оценить прогресс от 1 до 10",
            "values_clarification":"Помогаю понять, что для вас действительно важно",
            "exception_finding":  "Ищу моменты, когда проблема не проявляется",
            "future_pacing":      "Предлагаю представить желаемое будущее",
            "logical_analysis":   "Помогаю разобрать ситуацию логически"
        }
