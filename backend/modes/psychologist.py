#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: РЕЖИМ ПСИХОЛОГ (psychologist.py) — МНОГОАВТОРСКАЯ ВЕРСИЯ
Глубинная аналитическая работа с использованием конфайнтмент-модели и анализа петель.
ВЕРСИЯ 4.0 — многоавторская архитектура (8 авторов + Router)
"""

from typing import Dict, Any, List, Optional, AsyncGenerator
import random
import logging
from datetime import datetime
import re

# АБСОЛЮТНЫЕ ИМПОРТЫ (от корня backend)
from .base_mode import BaseMode
from profiles import VECTORS, LEVEL_PROFILES
from confinement.confinement_model import ConfinementModel9
from confinement.loop_analyzer import LoopAnalyzer
from services.ai_service import AIService

# Импорты для многоавторской архитектуры
from .prompts.psychologist import get_method, METHODS_REGISTRY
from .prompts.psychologist.router import (
    classify,
    detect_change_request,
    has_crisis_marker,
    CHANGE_METHOD_PATTERNS,
    CRISIS_MARKERS
)

logger = logging.getLogger(__name__)

class PsychologistMode(BaseMode):
    """
    Режим ПСИХОЛОГ — глубокая аналитическая работа.
    Версия 4.0: многоавторская архитектура с Router и 8 методами.
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context=None):
        super().__init__(user_id, user_data, context)

        self.ai_service = AIService()

        self.confinement_model = None
        self.loop_analyzer = None
        self._init_confinement_model(user_data)

        self.attachment_type = self.deep_patterns.get('attachment', 'исследуется')
        self.defenses = self.deep_patterns.get('defense_mechanisms', [])
        self.core_beliefs = self.deep_patterns.get('core_beliefs', [])
        self.fears = self.deep_patterns.get('fears', [])

        self.key_confinement = None
        self.loops_summary = None
        self.best_intervention = None

        if self.confinement_model:
            self._analyze_confinement()

        # ========== НОВОЕ: состояние для многоавторской архитектуры ==========
        self.current_method_code = user_data.get('current_method_code', None)
        self.method_selected_at = user_data.get('method_selected_at', None)
        self.method_changes_count = user_data.get('method_changes_count', 0)
        
        # Текущий метод (объект)
        self._current_method = None
        if self.current_method_code:
            self._current_method = get_method(self.current_method_code)

        logger.info(f"PsychologistMode инициализирован для user_id={user_id}")
        logger.info(f"📊 Текущий метод: {self.current_method_code}, смен: {self.method_changes_count}")
        if self.confinement_model:
            logger.info(f"📊 Конфайнтмент-модель: замкнутость={self.confinement_model.is_closed}, "
                        f"петель={len(self.confinement_model.loops)}")

    def _init_confinement_model(self, user_data: Dict[str, Any]):
        try:
            if user_data.get('confinement_model'):
                self.confinement_model = ConfinementModel9.from_dict(user_data['confinement_model'])
                logger.info("✅ Конфайнтмент-модель восстановлена")
            else:
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
        if not self.confinement_model:
            return
        try:
            class _ContextWrapper:
                def __init__(self, model):
                    self.confinement_model = model
                    self.user_id = model.user_id if hasattr(model, 'user_id') else None

            self.loop_analyzer = LoopAnalyzer(_ContextWrapper(self.confinement_model))
            loops = self.loop_analyzer.analyze()
            if hasattr(self.confinement_model, 'key_confinement'):
                self.key_confinement = self.confinement_model.key_confinement
            if loops:
                strongest = self.loop_analyzer.get_strongest_loop()
                if strongest:
                    self.best_intervention = self.loop_analyzer.get_best_intervention_point(strongest)
                    self.loops_summary = self.loop_analyzer.get_all_loops_summary()
            logger.info(f"🔍 Анализ завершён: {len(loops)} петель, замкнутость={self.confinement_model.is_closed}")
        except Exception as e:
            logger.error(f"Ошибка анализа петель: {e}")

    # ========== НОВЫЕ МЕТОДЫ ДЛЯ МНОГОАВТОРСКОЙ АРХИТЕКТУРЫ ==========

    async def _route_message(self, question: str, exclude: List[str] = None) -> Dict[str, Any]:
        """
        Вызывает Router для классификации запроса.
        
        Args:
            question: Текст сообщения пользователя
            exclude: Список методов для исключения (при смене)
        
        Returns:
            Результат классификации с method_code, confidence, reason, source
        """
        exclude = exclude or []
        
        result = await classify(
            user_message=question,
            history=self.history,
            exclude_methods=exclude,
            deepseek_client=self.ai_service,
            confidence_threshold=0.45
        )
        
        logger.info(f"🔀 Router: {result['method_code']} (уверенность={result['confidence']}, источник={result['source']})")
        return result

    def _user_wants_change(self, text: str) -> bool:
        """Определяет, хочет ли пользователь сменить метод."""
        return detect_change_request(text)

    def _has_crisis(self, text: str) -> bool:
        """Определяет, есть ли кризисный маркер."""
        return has_crisis_marker(text)

    async def _crisis_response(self) -> AsyncGenerator[str, None]:
        """Кризисный ответ. Фреди — не передатчик в другие руки, а опора прямо
        здесь и сейчас. Поэтому НЕ говорим «обратитесь к специалисту / в
        телефон доверия». Сами начинаем разговор: проверяем безопасность,
        снижаем напряжение, удерживаем человека в контакте."""
        yield (
            "Я тебя услышал. То, что ты сейчас сказал — серьёзно, и я не хочу "
            "оставлять тебя с этим одного. Я здесь.\n\n"
            "Прежде чем мы пойдём дальше — мне важно понять что прямо сейчас. "
            "Эти мысли появляются именно сегодня или это уже какое-то время? "
            "Есть что-то конкретное, что подталкивает их сейчас? И самое главное — "
            "что или кто рядом с тобой сейчас удерживает тебя на плаву?"
        )

    async def _stabilization_message(self) -> AsyncGenerator[str, None]:
        """Сообщение о достижении лимита смен метода."""
        yield ("Мы уже попробовали несколько подходов. Давайте задержимся на текущем — "
               "в психотерапии постоянная смена метода обычно мешает продвижению.")

    def _get_current_method(self):
        """Возвращает текущий объект метода."""
        if not self._current_method and self.current_method_code:
            self._current_method = get_method(self.current_method_code)
        return self._current_method

    def _set_current_method(self, method_code: str):
        """Устанавливает текущий метод."""
        self.current_method_code = method_code
        self._current_method = get_method(method_code)
        self.method_selected_at = datetime.now()
        
        # Сохраняем в user_data для persistence
        self.user_data['current_method_code'] = method_code
        self.user_data['method_selected_at'] = self.method_selected_at.isoformat()
        self.user_data['method_changes_count'] = self.method_changes_count

    def _save_method_state(self):
        """Сохраняет состояние метода в user_data."""
        self.user_data['current_method_code'] = self.current_method_code
        self.user_data['method_changes_count'] = self.method_changes_count
        if self.method_selected_at:
            self.user_data['method_selected_at'] = self.method_selected_at.isoformat()

    # ========== ОСНОВНОЙ ПОТОКОВЫЙ МЕТОД ==========

    async def process_question_streaming(
        self,
        question: str
    ) -> AsyncGenerator[str, None]:
        """
        Потоковая обработка с динамическим выбором автора.
        """
        logger.info(f"🎙️ PsychologistMode.process_question_streaming: {question[:50]}...")
        
        # 1. Кризисный фильтр
        if self._has_crisis(question):
            async for chunk in self._crisis_response():
                yield chunk
            self.save_to_history(question, "кризисный ответ")
            return
        
        # 2. Определяем, нужен ли роутинг
        is_first_turn = (self.current_method_code is None)
        wants_change = self._user_wants_change(question)
        needs_routing = is_first_turn or wants_change
        
        intro_or_notice = None
        
        if needs_routing:
            # Проверка лимита смен
            if wants_change and self.method_changes_count >= 3:
                async for chunk in self._stabilization_message():
                    yield chunk
                self.save_to_history(question, "стабилизация (лимит смен)")
                return
            
            # Определяем исключаемый метод (текущий при смене)
            exclude = [self.current_method_code] if wants_change and self.current_method_code else []
            
            # Вызов Router
            result = await self._route_message(question, exclude=exclude)
            new_method_code = result['method_code']
            old_method_code = self.current_method_code
            
            # Обновление состояния
            self._set_current_method(new_method_code)
            
            if wants_change and old_method_code:
                self.method_changes_count += 1
                self.user_data['method_changes_count'] = self.method_changes_count
                # Связующее сообщение при смене
                intro_or_notice = f"Хорошо, попробуем иначе. Теперь поработаем в подходе «{self._current_method.name_ru}».\n\n"
                logger.info(f"🔄 Смена метода: {old_method_code} → {new_method_code} (смена #{self.method_changes_count})")
            elif is_first_turn:
                # Вступительное сообщение при первой встрече
                intro_or_notice = self._current_method.introduction_message() + "\n\n"
                logger.info(f"🎯 Выбран метод: {new_method_code}")
            
            self._save_method_state()
        
        # 3. Получаем текущий метод
        method = self._get_current_method()
        if not method:
            # Fallback на Роджерса
            method = get_method("person_centered")
            self._set_current_method("person_centered")
        
        # 4. Строим сообщения для API
        is_first = (len(self.history) == 0)
        messages = method.build_messages(
            user_message=question,
            history=self.history,
            is_first_turn=is_first
        )

        # 4b. Phase: Кросс-сессионная память. Подмешиваем в начало system_prompt
        # сводки прошлых сессий (если есть). Параллельно — фоновая задача
        # сcammarize прошлой сессии (если она «закрылась»).
        memory_block = ""
        try:
            from session_memory import load_memory_block, schedule_summarize_in_background
            memory_block = await load_memory_block(self.user_id)
            schedule_summarize_in_background(self.user_id)
        except Exception as e:
            logger.debug(f"session_memory load failed: {e}")
        prompt_with_memory = (memory_block + method.system_prompt) if memory_block else method.system_prompt

        # 5. Отправляем вступительное сообщение (если есть)
        if intro_or_notice:
            yield intro_or_notice

        # 6. Вызов AI с динамическим системным промптом
        full_response = ""
        try:
            async for chunk in self.ai_service.generate_response_streaming(
                message=question,
                context=self._build_context_dict(),
                profile=self._build_profile_dict(),
                system_prompt=prompt_with_memory,  # система + память + метод
                temperature=method.temperature,
                top_p=method.top_p,
                max_tokens=method.max_tokens,
                frequency_penalty=method.frequency_penalty
            ):
                if chunk:
                    full_response += chunk
                    yield chunk
        except Exception as e:
            logger.error(f"Ошибка при вызове AI: {e}")
            fallback_response = "Я здесь. Расскажите подробнее, что вы чувствуете?"
            full_response = fallback_response
            yield fallback_response
        
        # 7. Сохраняем в историю
        if full_response:
            self.save_to_history(question, full_response)
        
        logger.info(f"✅ PsychologistMode ответ сгенерирован, метод={method.code}, длина={len(full_response)}")

    # ========== ПОЛНЫЙ ОТВЕТ (HTTP) ==========
    
    async def process_question_full(self, question: str) -> str:
        """
        Полная обработка вопроса для HTTP/голосового режима.
        """
        logger.info(f"🎙️ process_question_full в PsychologistMode")
        
        full_response = ""
        async for chunk in self.process_question_streaming(question):
            full_response += chunk
        
        if not full_response or not full_response.strip():
            full_response = "Вопрос интересный. Расскажите подробнее, пожалуйста."
        
        return full_response

    # ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

    def _build_profile_dict(self) -> Dict[str, Any]:
        """Строит словарь профиля для передачи в AI Service."""
        return {
            'profile_data': self.profile_data,
            'perception_type': self.perception_type,
            'thinking_level': self.thinking_level,
            'behavioral_levels': self.behavioral_levels,
            'deep_patterns': self.deep_patterns,
            'weakest_vector': getattr(self, 'weakest_vector', None),
            'weakest_level': getattr(self, 'weakest_level', None),
            'attachment_type': self.attachment_type,
            'history': self.history,
        }

    def _build_context_dict(self) -> Dict[str, Any]:
        """Строит словарь контекста для передачи в AI Service."""
        return {
            'name': self.context.name if self.context else None,
            'city': self.context.city if self.context else None,
            'age': self.context.age if self.context else None
        }

    # ========== СИНХРОННАЯ ВЕРСИЯ ДЛЯ СОВМЕСТИМОСТИ ==========

    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Синхронная версия (заглушка).
        Для реальной работы используйте process_question_streaming или process_question_full.
        """
        logger.warning("Используется синхронная версия process_question. Рекомендуется async-метод.")
        
        # Простой fallback
        return {
            "response": "Я здесь. Расскажите, что вас беспокоит?",
            "tools_used": ["fallback"],
            "follow_up": True,
            "suggestions": ["Расскажите подробнее", "Что вы сейчас чувствуете?"],
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }

    def get_system_prompt(self) -> str:
        """
        Возвращает системный промпт для текущего метода.
        Если метод не выбран — возвращает промпт Роджерса как default.
        """
        method = self._get_current_method()
        if method:
            return method.system_prompt
        return get_method("person_centered").system_prompt

    def get_greeting(self) -> str:
        """Возвращает приветствие режима."""
        name = ""
        if self.context and hasattr(self.context, 'name'):
            name = self.context.name or ""
        name_prefix = f"{name}, " if name else ""

        if self.key_confinement:
            elem = self.key_confinement.get('element')
            if elem:
                greetings = [
                    f"{name_prefix}я вижу, что в центре вашей системы — {elem.name.lower()}. Это то, что вас держит. Хотите исследовать это вместе?",
                    f"{name_prefix}я замечаю важный паттерн, связанный с {elem.name.lower()}. Расскажите, как это проявляется в вашей жизни?",
                ]
                return random.choice(greetings)

        if self.loop_analyzer and self.loop_analyzer.significant_loops:
            strongest = self.loop_analyzer.get_strongest_loop()
            if strongest:
                loop_type = strongest.get('type_name', 'паттерн')
                greetings = [
                    f"{name_prefix}я замечаю {loop_type.lower()}, которая повторяется в вашей жизни. Хотите посмотреть на неё вместе?",
                ]
                return random.choice(greetings)

        greetings = [
            f"{name_prefix}здравствуйте. Что привело вас сегодня?",
            f"Я рад нашей встрече{', ' + name if name else ''}. С чего бы вы хотели начать?",
        ]
        return random.choice(greetings)

    def get_tools_description(self) -> Dict[str, str]:
        """Возвращает описание доступных инструментов."""
        base_tools = {
            "confinement_work": "Анализ структуры ограничений",
            "loop_analysis": "Распознавание рекурсивных петель",
            "defense_work": "Мягкая работа с защитными механизмами",
            "feelings_work": "Исследование телесных ощущений и эмоций",
            "depth_analysis": "Глубинный анализ паттернов",
            "attachment_work": "Работа с типом привязанности"
        }
        
        # Добавляем информацию о текущем методе
        method = self._get_current_method()
        if method:
            base_tools["current_method"] = f"{method.name_ru} ({method.author_name})"
        
        return base_tools

    # ========== МЕТОДЫ ДЛЯ ФРОНТЕНДА ==========

    def get_current_method_info(self) -> Dict[str, Any]:
        """Возвращает информацию о текущем методе для UI."""
        method = self._get_current_method()
        if not method:
            return {
                "code": None,
                "name_ru": None,
                "author_name": None,
                "short_description": None,
                "changes_count": self.method_changes_count,
                "max_changes": 3
            }
        
        return {
            "code": method.code,
            "name_ru": method.name_ru,
            "author_name": method.author_name,
            "short_description": method.short_description,
            "changes_count": self.method_changes_count,
            "max_changes": 3
        }

    def get_available_methods(self) -> List[Dict[str, Any]]:
        """Возвращает список всех доступных методов для UI."""
        methods = []
        for code, method in METHODS_REGISTRY.items():
            methods.append({
                "code": code,
                "name_ru": method.name_ru,
                "author_name": method.author_name,
                "short_description": method.short_description,
                "is_current": (code == self.current_method_code)
            })
        return methods
