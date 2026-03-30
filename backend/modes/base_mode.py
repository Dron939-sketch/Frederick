#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (base_mode.py)
Базовый класс для всех режимов общения (КОУЧ/ПСИХОЛОГ/ТРЕНЕР/BASIC)
Интегрирован с конфайнтмент-моделью и гипнотическими техниками
Поддержка потоковой обработки для живого голосового диалога
ВЕРСИЯ 2.1 — с совместимостью для voice_service
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, AsyncGenerator
import logging
from datetime import datetime
import random
import asyncio
import re

# Импорты для новой структуры
from confinement import ConfinementModel9
from hypno import HypnoOrchestrator, TherapeuticTales, Anchoring
from profiles import VECTORS, LEVEL_PROFILES, DILTS_LEVELS

logger = logging.getLogger(__name__)


class BaseMode(ABC):
    """
    Базовый класс для всех режимов общения.
    Интегрирован с конфайнтмент-моделью и гипнотическими техниками.
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        """
        Инициализация базового режима
        """
        self.user_id = user_id
        self.user_data = user_data
        self.context = context
        self.name = self.__class__.__name__

        # Базовая информация о пользователе
        self.profile = user_data.get("profile_data", {})
        self.perception_type = user_data.get("perception_type", "не определен")
        self.thinking_level = user_data.get("thinking_level", 5)
        self.deep_patterns = user_data.get("deep_patterns", {})

        # История диалога
        self.history = user_data.get("history", [])

        # Последние использованные инструменты
        self.last_tools_used: List[str] = []

        # === ИНИЦИАЛИЗАЦИЯ КЛЮЧЕВЫХ СИСТЕМ ===
        # 1. Конфайнтмент-модель
        self.confinement_model = None
        model_data = user_data.get("confinement_model")
        if model_data:
            try:
                self.confinement_model = ConfinementModel9.from_dict(model_data)
            except Exception as e:
                logger.warning(f"Не удалось загрузить конфайнтмент-модель: {e}")

        # 2. Гипнотический оркестратор
        self.hypno = HypnoOrchestrator()

        # 3. Терапевтические сказки
        self.tales = TherapeuticTales()

        # 4. Якорение
        self.anchoring = Anchoring()

        # 5. Векторные scores
        self.scores = {}
        behavioral_levels = user_data.get("behavioral_levels", {})
        for k in ["СБ", "ТФ", "УБ", "ЧВ"]:
            levels = behavioral_levels.get(k, [])
            if levels:
                self.scores[k] = sum(levels) / len(levels)
            else:
                self.scores[k] = 3.0

        # 6. Самое слабое место
        if self.scores:
            min_vector = min(self.scores.items(), key=lambda x: self._level(x[1]))
            self.weakest_vector, self.weakest_score = min_vector
            self.weakest_level = self._level(self.weakest_score)
            self.weakest_profile = LEVEL_PROFILES.get(self.weakest_vector, {}).get(self.weakest_level, {})
        else:
            self.weakest_vector = "СБ"
            self.weakest_score = 3.0
            self.weakest_level = 3
            self.weakest_profile = {}

        logger.info(f"BaseMode инициализирован для user_id={user_id}, режим={self.name}")

    # ====================== СВОЙСТВА ДЛЯ СОВМЕСТИМОСТИ С voice_service ======================
    @property
    def profile_data(self) -> Dict[str, Any]:
        """Совместимость с voice_service (алиас для profile)"""
        return getattr(self, 'profile', {})

    @profile_data.setter
    def profile_data(self, value: Dict[str, Any]):
        """Сеттер для profile_data"""
        self.profile = value

    @property
    def behavioral_levels(self) -> Dict[str, List[float]]:
        """Совместимость с voice_service"""
        return self.user_data.get('behavioral_levels', {})

    @property
    def deep_patterns_data(self) -> Dict[str, Any]:
        """Совместимость с voice_service"""
        return getattr(self, 'deep_patterns', {})

    @property
    def confinement_model_data(self) -> Optional[Dict]:
        """Возвращает данные конфайнтмент-модели для voice_service"""
        if hasattr(self, 'confinement_model') and self.confinement_model:
            if hasattr(self.confinement_model, 'to_dict'):
                return self.confinement_model.to_dict()
        return self.user_data.get('confinement_model', None)
    # ====================================================================

    def _level(self, score: float) -> int:
        """Дробный балл 1..6 → целый уровень 1..6"""
        if score <= 1.49:
            return 1
        elif score <= 2.00:
            return 2
        elif score <= 2.50:
            return 3
        elif score <= 3.00:
            return 4
        elif score <= 3.50:
            return 5
        else:
            return 6

    # ====================== АБСТРАКТНЫЕ МЕТОДЫ ======================
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Возвращает системный промпт для режима"""
        pass

    @abstractmethod
    def get_greeting(self) -> str:
        """Возвращает приветствие режима"""
        pass

    @abstractmethod
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Синхронная версия (заглушка).
        Для BasicMode переопределяется process_question_streaming.
        """
        return {
            "response": "",
            "tools_used": [],
            "follow_up": False,
            "suggestions": [],
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }

    # ====================== ПОТОКОВАЯ ОБРАБОТКА ======================
    async def process_question_streaming(
        self,
        question: str
    ) -> AsyncGenerator[str, None]:
        """
        Основной потоковый метод.
        Если наследник переопределил этот метод — вызываем его версию.
        """
        logger.info(f"🎙️ process_question_streaming в режиме {self.name}")

        # Проверяем, переопределён ли метод в дочернем классе (BasicMode и др.)
        if 'process_question_streaming' in self.__class__.__dict__ and self.__class__.__name__ != "BaseMode":
            async for chunk in self.__class__.process_question_streaming(self, question):
                yield chunk
            return

        # Стандартный путь для PsychologistMode, CoachMode, TrainerMode
        result = self.process_question(question)
        full_response = result.get("response", "")

        # Восстанавливаем пунктуацию перед отправкой
        full_response = self._restore_punctuation(full_response)
        
        self.save_to_history(question, full_response)

        # Разбиваем на предложения и отправляем по одному
        sentences = self._split_into_sentences(full_response)
        for sentence in sentences:
            if sentence.strip():
                yield sentence.strip()
                await asyncio.sleep(0.05)

        # Добавляем follow-up, если нужно
        if result.get("follow_up"):
            follow_up_text = self._get_follow_up_suggestion(result)
            follow_up_text = self._restore_punctuation(follow_up_text)
            for sentence in self._split_into_sentences(follow_up_text):
                if sentence.strip():
                    yield sentence.strip()
                    await asyncio.sleep(0.05)

    def _restore_punctuation(self, text: str) -> str:
        """
        Восстанавливает знаки препинания в тексте для голосового вывода.
        """
        if not text:
            return text
        
        original = text
        
        # 1. Добавляем точку в конце, если её нет
        if text and text[-1] not in '.!?':
            text += '.'
        
        # 2. Добавляем пробел после знаков препинания, если его нет
        text = re.sub(r'([.!?])([А-ЯЁA-Zа-яёa-z0-9])', r'\1 \2', text)
        
        # 3. Убираем дублирующиеся знаки препинания
        text = re.sub(r'([.!?])\1+', r'\1', text)
        text = re.sub(r'([,;:])\1+', r'\1', text)
        
        # 4. Исправляем тире
        text = re.sub(r'\s*-\s*,?\s*', ' — ', text)
        
        # 5. Убираем запятые после частицы "не"
        text = re.sub(r'\b(не|ни)\s*,', r'\1', text, flags=re.IGNORECASE)
        
        # 6. Нормализуем пробелы
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\s*([.,!?:;])\s*', r'\1 ', text)
        text = re.sub(r'\s+([.,!?:;])', r'\1', text)
        
        # 7. Убираем множественные знаки в конце
        if len(text) > 1 and text[-1] in '.!?' and text[-2] in '.!?':
            text = text[:-1]
        
        if text != original:
            logger.debug(f"🔄 Восстановлена пунктуация в BaseMode: '{original[:100]}' → '{text[:100]}'")
        
        return text

    def _split_into_sentences(self, text: str) -> List[str]:
        """
        Разбивает текст на предложения аккуратно.
        """
        if not text:
            return []
        
        # Сначала добавляем точку где нужно
        if text and text[-1] not in '.!?':
            text += '.'
        
        # Разбиваем по знакам препинания
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        result = []
        for s in sentences:
            cleaned = s.strip()
            if cleaned:
                result.append(cleaned)
        
        return result

    def _get_follow_up_suggestion(self, result: Dict[str, Any]) -> str:
        """Возвращает предложение для продолжения диалога"""
        suggestions = result.get("suggestions", [])
        if suggestions:
            return f"Кстати, вы можете спросить меня: {suggestions[0]}"
        
        default_suggestions = {
            "PsychologistMode": "Расскажите подробнее о том, что вас беспокоит?",
            "CoachMode": "Как вы видите следующий шаг к этой цели?",
            "TrainerMode": "Что вы чувствуете сейчас, думая об этом?",
            "BasicMode": "О чём ещё поговорим?"
        }
        return default_suggestions.get(self.name, "Что вы думаете об этом?")

    # ====================== АНАЛИЗ ПРОФИЛЯ ======================
    def analyze_profile_for_response(self) -> Dict[str, Any]:
        """
        Анализирует профиль пользователя для формирования ответа.
        Возвращает словарь с ключевыми характеристиками.
        """
        analysis = {
            "attention_focus": self._get_attention_focus(),
            "thinking_depth": self._get_thinking_depth(),
            "pain_points": self._get_pain_points(),
            "growth_area": self._get_growth_area(),
            "weakest_vector": self.weakest_vector,
            "weakest_level": self.weakest_level,
            "weakest_description": self.weakest_profile.get('quote', ''),
            "key_confinement": self._get_key_confinement_info(),
            "loops": self._get_loops_info()
        }
        return analysis

    def _get_key_confinement_info(self) -> Optional[Dict]:
        """Возвращает информацию о ключевом конфайнтменте"""
        if self.confinement_model and hasattr(self.confinement_model, 'key_confinement'):
            key_conf = self.confinement_model.key_confinement
            if key_conf and key_conf.get('element'):
                elem = key_conf['element']
                return {
                    'id': getattr(elem, 'id', None),
                    'name': getattr(elem, 'name', None),
                    'description': getattr(elem, 'description', None),
                    'type': getattr(elem, 'element_type', None),
                    'vector': getattr(elem, 'vector', None),
                    'strength': getattr(elem, 'strength', None)
                }
        return None

    def _get_loops_info(self) -> List[Dict]:
        """Возвращает информацию о петлях"""
        if self.confinement_model and hasattr(self.confinement_model, 'loops'):
            loops = self.confinement_model.loops
            if loops:
                return [
                    {
                        'type': loop.get('type', 'unknown'),
                        'description': loop.get('description', ''),
                        'strength': loop.get('strength', 0)
                    }
                    for loop in loops
                ]
        return []

    def _get_attention_focus(self) -> str:
        """Определяет фокус внимания (внешний/внутренний)"""
        if self.perception_type in ["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ", "СТАТУСНО-ОРИЕНТИРОВАННЫЙ"]:
            return "external"
        return "internal"

    def _get_thinking_depth(self) -> str:
        """Определяет глубину мышления"""
        if self.thinking_level <= 3:
            return "concrete"
        elif self.thinking_level <= 6:
            return "systemic"
        else:
            return "deep"

    def _get_pain_points(self) -> List[str]:
        """Возвращает список болевых точек"""
        points = []
        if self.weakest_profile:
            pain_costs = self.weakest_profile.get('pain_costs', [])
            if pain_costs:
                points.extend(pain_costs)
        if self.deep_patterns:
            fears = self.deep_patterns.get('fears', [])
            points.extend(fears[:2])
            defenses = self.deep_patterns.get('defenses', [])
            if defenses:
                points.append(f"защита: {defenses[0]}")
        return [p for p in points if p][:3]

    def _get_growth_area(self) -> str:
        """Определяет зону роста"""
        dilts_counts = self.user_data.get("dilts_counts", {})
        if dilts_counts:
            dominant = max(dilts_counts.items(), key=lambda x: x[1])[0]
            return DILTS_LEVELS.get(dominant, "Поведение")
        return "Поведение"

    # ====================== КОНТЕКСТ И ИСТОРИЯ ======================
    def get_context_string(self) -> str:
        """Возвращает строку с контекстом пользователя"""
        lines = []
        if self.context:
            if hasattr(self.context, 'gender') and self.context.gender:
                gender_str = 'мужской' if self.context.gender == 'male' else 'женский'
                lines.append(f"Пол пользователя: {gender_str}")
            if hasattr(self.context, 'age') and self.context.age:
                lines.append(f"Возраст: {self.context.age}")
            if hasattr(self.context, 'city') and self.context.city:
                lines.append(f"Город: {self.context.city}")
            if hasattr(self.context, 'get_day_context'):
                try:
                    day = self.context.get_day_context()
                    lines.append(f"Время: {day.get('time_str', '')}, {day.get('weekday', '')}")
                except:
                    pass
            if hasattr(self.context, 'weather_cache') and self.context.weather_cache:
                w = self.context.weather_cache
                lines.append(f"Погода: {w.get('icon', '')} {w.get('description', '')}, {w.get('temp', '')}°C")
        return "\n".join(lines)

    def get_response_context(self) -> str:
        """
        Возвращает полный контекст для ответа с учётом режима.
        Включает профиль, ограничения, петли и историю.
        """
        context_parts = []
        
        # Профиль пользователя
        if self.profile:
            profile_code = self.profile.get('display_name', '')
            if profile_code:
                context_parts.append(f"Профиль пользователя: {profile_code}")
        
        # Ключевая характеристика
        if self.weakest_profile:
            quote = self.weakest_profile.get('quote', '')
            if quote:
                context_parts.append(f"Ключевая характеристика: {quote[:100]}")
        
        # Ключевой конфайнтмент
        key_conf = self._get_key_confinement_info()
        if key_conf and key_conf.get('description'):
            context_parts.append(f"Ключевое ограничение: {key_conf['description'][:100]}")
        
        # Петли
        loops = self._get_loops_info()
        if loops:
            strongest = max(loops, key=lambda x: x.get('strength', 0))
            context_parts.append(f"Главная петля: {strongest.get('description', '')[:100]}")
        
        # Недавний диалог (последние 4 сообщения = 2 обмена)
        if self.history:
            last_messages = self.history[-4:]
            context_parts.append("\nНедавний диалог:")
            for msg in last_messages:
                role = "Пользователь" if msg.get('role') == 'user' else "Ассистент"
                content = msg.get('content', '')[:100]
                context_parts.append(f"{role}: {content}")
        
        return "\n".join(context_parts)

    def save_to_history(self, question: str, response: str):
        """Сохраняет диалог в историю"""
        self.history.append({
            "role": "user",
            "content": question,
            "timestamp": datetime.now().isoformat()
        })
        self.history.append({
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now().isoformat(),
            "mode": self.name,
            "tools_used": self.last_tools_used.copy()
        })
        # Ограничиваем историю
        if len(self.history) > 50:
            self.history = self.history[-50:]
        self.user_data["history"] = self.history

    # ====================== ГИПНО, СКАЗКИ, ЯКОРЯ ======================
    def suggest_tale(self, issue: str = None) -> Optional[Dict]:
        """
        Предлагает терапевтическую сказку по теме.
        Если тема не указана, выбирает по слабому вектору.
        """
        if not issue:
            vector_names = {"СБ": "страх", "ТФ": "деньги", "УБ": "понимание", "ЧВ": "отношения"}
            issue = vector_names.get(self.weakest_vector, "рост")
        
        if self.tales:
            try:
                return self.tales.get_tale_for_issue(issue)
            except Exception as e:
                logger.error(f"Ошибка при получении сказки: {e}")
        
        return {
            'title': 'Сказка о переменах',
            'text': 'Жил-был человек. Однажды он понял, что может меняться. И мир изменился вместе с ним.',
            'issue': issue
        }

    def create_anchor(self, trigger: str, resource_state: str) -> Dict:
        """Создаёт якорь для ресурсного состояния"""
        if self.anchoring:
            try:
                return self.anchoring.create_anchor(self.user_id, trigger, resource_state)
            except Exception as e:
                logger.error(f"Ошибка при создании якоря: {e}")
        return {'success': False, 'error': 'Якорение недоступно'}

    def fire_anchor(self, trigger: str) -> bool:
        """Активирует якорь"""
        if self.anchoring:
            try:
                return self.anchoring.fire_anchor(self.user_id, trigger)
            except Exception as e:
                logger.error(f"Ошибка при активации якоря: {e}")
        return False

    def __repr__(self) -> str:
        return f"<{self.name}(user_id={self.user_id})>"
