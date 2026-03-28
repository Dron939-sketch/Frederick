#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (base_mode.py)
Базовый класс для всех режимов общения (КОУЧ/ПСИХОЛОГ/ТРЕНЕР)
Интегрирован с конфайнтмент-моделью и гипнотическими техниками
Поддержка потоковой обработки для живого голосового диалога
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Tuple, AsyncGenerator
import logging
from datetime import datetime
import random
import asyncio

# Импорты для новой структуры
from confinement import ConfinementModel9
from hypno import HypnoOrchestrator, TherapeuticTales, Anchoring
from profiles import VECTORS, LEVEL_PROFILES, DILTS_LEVELS

logger = logging.getLogger(__name__)


class BaseMode(ABC):
    """
    Базовый класс для всех режимов общения.
    Интегрирован с конфайнтмент-моделью и гипнотическими техниками.
    Поддерживает потоковую обработку для живого голосового диалога.
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        """
        Инициализация базового режима
        
        Args:
            user_id: ID пользователя
            user_data: словарь с данными пользователя (профиль, история и т.д.)
            context: объект контекста пользователя (UserContext)
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
        
        # Последние использованные инструменты (для сохранения в историю)
        self.last_tools_used = []
        
        # === ИНИЦИАЛИЗАЦИЯ КЛЮЧЕВЫХ СИСТЕМ ===
        
        # 1. Конфайнтмент-модель (ограничивающие убеждения)
        self.confinement_model = None
        model_data = user_data.get("confinement_model")
        if model_data:
            try:
                self.confinement_model = ConfinementModel9.from_dict(model_data)
            except Exception as e:
                logger.warning(f"Не удалось загрузить конфайнтмент-модель: {e}")
        
        # 2. Гипнотический оркестратор (для трансовых техник)
        self.hypno = HypnoOrchestrator()
        
        # 3. Терапевтические сказки
        self.tales = TherapeuticTales()
        
        # 4. Якорение (для ресурсных состояний)
        self.anchoring = Anchoring()
        
        # 5. Векторные scores (СБ, ТФ, УБ, ЧВ)
        self.scores = {}
        behavioral_levels = user_data.get("behavioral_levels", {})
        for k in ["СБ", "ТФ", "УБ", "ЧВ"]:
            levels = behavioral_levels.get(k, [])
            if levels:
                self.scores[k] = sum(levels) / len(levels)
            else:
                self.scores[k] = 3.0
        
        # 6. Определяем самое слабое место (главный тормоз)
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
        Обрабатывает вопрос пользователя (синхронная версия)
        
        Returns:
            dict: {
                "response": str,           # текст ответа
                "tools_used": List[str],   # использованные инструменты
                "follow_up": bool,         # нужно ли уточнение
                "suggestions": List[str],  # предложения для продолжения
                "hypnotic_suggestion": bool, # было ли гипнотическое внушение
                "tale_suggested": bool     # была ли предложена сказка
            }
        """
        pass
    
    async def process_question_streaming(
        self, 
        question: str,
        chunk_size: int = 100
    ) -> AsyncGenerator[str, None]:
        """
        ПОТОКОВАЯ обработка вопроса - отправляет ответ по частям.
        Используется для живого голосового диалога, где нужно
        начинать говорить до полного формирования ответа.
        
        Args:
            question: текст вопроса пользователя
            chunk_size: размер чанка в символах
        
        Yields:
            str: части ответа (предложения или фразы)
        """
        logger.info(f"🎙️ Потоковая обработка вопроса в режиме {self.name}")
        
        # Получаем полный ответ через синхронный метод
        result = self.process_question(question)
        full_response = result["response"]
        
        # Сохраняем в историю (один раз, а не для каждого чанка)
        self.save_to_history(question, full_response)
        
        # Разбиваем на предложения для естественного звучания
        sentences = self._split_into_sentences(full_response)
        
        for i, sentence in enumerate(sentences):
            if sentence.strip():
                yield sentence.strip()
                # Небольшая пауза между предложениями для естественности
                await asyncio.sleep(0.05)
        
        # Если есть дополнительные предложения (follow-up), добавляем их
        if result.get("follow_up"):
            follow_up_sentences = self._split_into_sentences(
                f"\n\n{self._get_follow_up_suggestion(result)}"
            )
            for sentence in follow_up_sentences:
                if sentence.strip():
                    yield sentence.strip()
                    await asyncio.sleep(0.05)
        
        logger.info(f"✅ Потоковая обработка завершена, отправлено {len(sentences)} фрагментов")
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """
        Разбивает текст на предложения для потоковой отправки
        
        Args:
            text: исходный текст
        
        Returns:
            список предложений
        """
        if not text:
            return []
        
        # Разделители предложений
        separators = ['。', '.', '!', '?', '!?', '?!', '\n\n', '\n']
        
        # Сначала пробуем разбить по переносам строк
        if '\n\n' in text:
            parts = text.split('\n\n')
            result = []
            for part in parts:
                result.extend(self._split_by_punctuation(part))
            return result
        
        return self._split_by_punctuation(text)
    
    def _split_by_punctuation(self, text: str) -> List[str]:
        """Разбивает текст по знакам препинания"""
        sentences = []
        current = []
        
        for char in text:
            current.append(char)
            if char in ['。', '.', '!', '?']:
                sentence = ''.join(current).strip()
                if sentence:
                    sentences.append(sentence)
                current = []
        
        # Добавляем остаток
        if current:
            remainder = ''.join(current).strip()
            if remainder:
                sentences.append(remainder)
        
        return sentences
    
    def _get_follow_up_suggestion(self, result: Dict[str, Any]) -> str:
        """
        Генерирует предложение для продолжения диалога
        
        Args:
            result: результат обработки вопроса
        
        Returns:
            текст с предложением продолжения
        """
        suggestions = result.get("suggestions", [])
        if suggestions:
            return f"Кстати, вы можете спросить меня: {suggestions[0]}"
        
        # Дефолтные предложения в зависимости от режима
        default_suggestions = {
            "PsychologistMode": "Расскажите подробнее о том, что вас беспокоит?",
            "CoachMode": "Как вы видите следующий шаг к этой цели?",
            "TrainerMode": "Что вы чувствуете сейчас, думая об этом?"
        }
        
        return default_suggestions.get(self.name, "Что вы думаете об этом?")
    
    def analyze_profile_for_response(self) -> Dict[str, Any]:
        """Анализирует профиль для настройки ответа"""
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
        """Возвращает информацию о ключевом ограничении"""
        if self.confinement_model and hasattr(self.confinement_model, 'key_confinement'):
            key_conf = self.confinement_model.key_confinement
            if key_conf and key_conf.get('element'):
                elem = key_conf['element']
                return {
                    'id': elem.id if hasattr(elem, 'id') else None,
                    'name': elem.name if hasattr(elem, 'name') else None,
                    'description': elem.description if hasattr(elem, 'description') else None,
                    'type': elem.element_type if hasattr(elem, 'element_type') else None,
                    'vector': elem.vector if hasattr(elem, 'vector') else None,
                    'strength': elem.strength if hasattr(elem, 'strength') else None
                }
        return None
    
    def _get_loops_info(self) -> List[Dict]:
        """Возвращает информацию о циклах"""
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
        """Определяет фокус внимания пользователя"""
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
        """Определяет болевые точки из профиля"""
        points = []
        
        # Из самого слабого вектора
        if self.weakest_profile:
            pain_costs = self.weakest_profile.get('pain_costs', [])
            if pain_costs:
                points.extend(pain_costs)
        
        # Из глубинных паттернов
        if self.deep_patterns:
            fears = self.deep_patterns.get('fears', [])
            points.extend(fears[:2])
            
            defenses = self.deep_patterns.get('defenses', [])
            if defenses:
                points.append(f"защита: {defenses[0]}")
        
        # Фильтруем пустые и берем максимум 3
        return [p for p in points if p][:3]
    
    def _get_growth_area(self) -> str:
        """Определяет зону роста из DILTS_LEVELS"""
        dilts_counts = self.user_data.get("dilts_counts", {})
        if dilts_counts:
            dominant = max(dilts_counts.items(), key=lambda x: x[1])[0]
            return DILTS_LEVELS.get(dominant, "Поведение")
        return "Поведение"
    
    def get_context_string(self) -> str:
        """Возвращает контекст для вставки в промпт"""
        lines = []
        
        if self.context:
            # Пол
            if hasattr(self.context, 'gender') and self.context.gender:
                gender_str = 'мужской' if self.context.gender == 'male' else 'женский'
                lines.append(f"Пол пользователя: {gender_str}")
            
            # Возраст
            if hasattr(self.context, 'age') and self.context.age:
                lines.append(f"Возраст: {self.context.age}")
            
            # Город
            if hasattr(self.context, 'city') and self.context.city:
                lines.append(f"Город: {self.context.city}")
            
            # Время
            if hasattr(self.context, 'get_day_context'):
                try:
                    day = self.context.get_day_context()
                    lines.append(f"Время: {day.get('time_str', '')}, {day.get('weekday', '')}")
                except Exception:
                    pass
            
            # Погода
            if hasattr(self.context, 'weather_cache') and self.context.weather_cache:
                w = self.context.weather_cache
                lines.append(f"Погода: {w.get('icon', '')} {w.get('description', '')}, {w.get('temp', '')}°C")
        
        return "\n".join(lines)
    
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
        
        # Обновляем в user_data
        self.user_data["history"] = self.history
        
        # Ограничиваем историю 50 сообщениями
        if len(self.history) > 50:
            self.history = self.history[-50:]
    
    def suggest_tale(self, issue: str = None) -> Optional[Dict]:
        """Предлагает терапевтическую сказку по проблеме"""
        if not issue:
            # Если проблема не указана, берём из слабого вектора
            vector_names = {"СБ": "страх", "ТФ": "деньги", "УБ": "понимание", "ЧВ": "отношения"}
            issue = vector_names.get(self.weakest_vector, "рост")
        
        if self.tales:
            try:
                return self.tales.get_tale_for_issue(issue)
            except Exception as e:
                logger.error(f"Ошибка при получении сказки: {e}")
        
        # Возвращаем базовую сказку, если ничего не найдено
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
        
        return {
            'success': False,
            'error': 'Якорение недоступно',
            'anchor': {
                'user_id': self.user_id,
                'trigger': trigger,
                'state': resource_state
            }
        }
    
    def fire_anchor(self, trigger: str) -> bool:
        """Активирует якорь"""
        if self.anchoring:
            try:
                return self.anchoring.fire_anchor(self.user_id, trigger)
            except Exception as e:
                logger.error(f"Ошибка при активации якоря: {e}")
        return False
    
    def get_response_context(self) -> str:
        """
        Формирует контекст для ответа AI
        """
        context_parts = []
        
        # Информация о профиле
        if self.profile:
            profile_code = self.profile.get('display_name', '')
            if profile_code:
                context_parts.append(f"Профиль пользователя: {profile_code}")
        
        # Информация о слабом месте
        if self.weakest_profile:
            quote = self.weakest_profile.get('quote', '')
            if quote:
                context_parts.append(f"Ключевая характеристика: {quote[:100]}")
        
        # Информация о ключевом ограничении
        key_conf = self._get_key_confinement_info()
        if key_conf and key_conf.get('description'):
            context_parts.append(f"Ключевое ограничение: {key_conf['description'][:100]}")
        
        # Информация о петлях
        loops = self._get_loops_info()
        if loops:
            strongest = max(loops, key=lambda x: x.get('strength', 0))
            context_parts.append(f"Главная петля: {strongest.get('description', '')[:100]}")
        
        return "\n".join(context_parts)
    
    def __repr__(self) -> str:
        return f"<{self.name}(user_id={self.user_id})>"
