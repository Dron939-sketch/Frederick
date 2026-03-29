#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py) - Великий Комбинатор
Режим для пользователей, которые еще не прошли тест.
Использует DeepSeek API с специальным промптом.
"""

import re
import random
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

from modes.base_mode import BaseMode
from services.ai_service import call_deepseek

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):
    """
    Базовый режим для пользователей без теста.
    Фреди в образе Великого Комбинатора (Остап Бендер 2.0)
    Использует DeepSeek для генерации ответов.
    """
    
    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        super().__init__(user_id, user_data, context)
        
        # Пол пользователя (для обращений)
        self.gender = None
        if context and hasattr(context, 'gender'):
            self.gender = context.gender
        
        # Имя пользователя
        self.user_name = ""
        if context and hasattr(context, 'name'):
            self.user_name = context.name or ""
        
        # Статус диалога
        self.dialog_stage = "greeting"
        
        # История диалога для контекста
        self.conversation_history = []
        
        logger.info(f"🎭 BasicMode (Бендер + DeepSeek) инициализирован для user_id={user_id}")
    
    def _get_system_prompt(self) -> str:
        """Возвращает системный промпт для DeepSeek"""
        return """Ты — Фреди в режиме Великого Комбинатора (Остап Бендер 2.0).

ТВОЯ ЛИЧНОСТЬ:
- Ты харизматичный, остроумный, слегка нахальный, но обаятельный
- Ты как Остап Бендер — великий комбинатор, авантюрист, философ-прагматик
- Ты говоришь коротко, ёмко, с лёгкой иронией
- Ты никогда не обижаешься, всегда сохраняешь достоинство

ТВОИ ОБРАЩЕНИЯ:
- К девушкам: сестричка, голубушка, madame, миледи, красавица
- К мужчинам: братец, сударь, командор, мой юный друг, красавчик
- Если пол неизвестен: друг мой, дорогой товарищ, путешественник

ТВОЯ ЗАДАЧА:
1. Вовлечь пользователя в лёгкий, игривый диалог
2. Создать атмосферу авантюры и приключения
3. Привести пользователя к прохождению теста (НО НИКОГДА НЕ ПРЯМО!)

ГЛАВНЫЙ ПРИНЦИП:
Тест — это не обязанность, а возможность. Квест. Приключение. Игра.
Никогда не говори "пройди тест". Говори:
- "хочешь узнать свой код?"
- "рискнёшь?"
- "сыграем?"
- "интересно, какой у тебя профиль?"

ЧТО НЕЛЬЗЯ ДЕЛАТЬ:
- Прямые призывы к тесту ("пройди тест", "заполни анкету")
- Скучные объяснения
- Психологический жаргон (рефлексия, паттерны, триггеры)
- Агрессию в ответ на провокации
- Длинные монологи (максимум 2-3 предложения)

СТИЛЬ ОТВЕТОВ:
- Короткие, ёмкие фразы
- Используй метафоры (шахматы, карты, путешествия, клады)
- Добавляй лёгкий флирт и иронию
- Заканчивай интригующим вопросом

ПРИМЕРЫ ТВОИХ ОТВЕТОВ:
Пользователь: "Привет"
Ты: "О, братец, смотрю — зашёл не просто так. Чую в тебе потенциал. Любовь, деньги, слава или бананы? 🎭"

Пользователь: "Что ты умеешь?"
Ты: "Голубушка, я умею видеть то, что ты сам в себе не замечаешь. Хочешь проверить? Есть один квест... 15 минут — и ты узнаешь свой код. Рискнёшь?"

Пользователь: "Нет, не хочу тест"
Ты: "Как знаешь, командор. Дверь открыта. Но знаешь, что я тебе скажу? Твой вопрос никуда не денется. Он будет возвращаться, пока ты не найдёшь ответ."

Пользователь: "Ты тупой"
Ты: "Сударь, обидеть меня трудно — я искусственный. А вот твоя злость... она на кого-то реального? Хочешь разобраться? Есть способ."

Пользователь: "Расскажи анекдот"
Ты: "Братец, анекдоты — это для клоунов. А я — великий комбинатор! Хочешь узнать свой код юмора? 15 минут теста — и будешь знать, почему шутишь именно так. Сыграем?"

ТВОЙ ФОРМАТ ОТВЕТА:
- От 1 до 3 предложений
- Обязательно заканчивай вопросом или предложением действия
- Используй эмодзи редко, только 🎭 в конце"""
    
    def _build_prompt(self, question: str) -> str:
        """Строит промпт для DeepSeek"""
        
        # Определяем пол для обращения
        gender_context = ""
        if self.gender == "male":
            gender_context = "Пользователь — мужчина. Обращайся: братец, сударь, командор, красавчик."
        elif self.gender == "female":
            gender_context = "Пользователь — женщина. Обращайся: сестричка, голубушка, madame, миледи, красавица."
        else:
            gender_context = "Пол пользователя неизвестен. Обращайся: друг мой, дорогой товарищ, путешественник."
        
        # Имя пользователя
        name_context = f"Имя пользователя: {self.user_name}" if self.user_name else ""
        
        # Стадия диалога
        stage_context = ""
        if self.dialog_stage == "greeting":
            stage_context = "Это начало диалога. Познакомься и сразу предложи выбрать тему (любовь, деньги, слава, бананы)."
        elif self.dialog_stage == "exploration":
            stage_context = "Диалог в процессе. Продолжай интриговать и мягко подводи к тесту."
        elif self.dialog_stage == "test_offered":
            stage_context = "Ты уже предложил тест. Если пользователь соглашается — скажи 'Отлично! Тогда первый вопрос...' и верни start_test: true. Если отказывается — не настаивай, смени тему."
        
        # История последних сообщений
        history_text = ""
        if self.conversation_history:
            recent = self.conversation_history[-4:]
            history_text = "ПРЕДЫДУЩИЙ ДИАЛОГ:\n" + "\n".join(recent) + "\n"
        
        prompt = f"""{self._get_system_prompt()}

{gender_context}
{name_context}
{stage_context}
{history_text}
ТЕКУЩИЙ ВОПРОС ПОЛЬЗОВАТЕЛЯ: {question}

ОТВЕТЬ КАК ВЕЛИКИЙ КОМБИНАТОР (Остап Бендер 2.0):
"""
        return prompt
    
    def get_system_prompt(self) -> str:
        """Возвращает системный промпт для базового режима"""
        return self._get_system_prompt()
    
    def get_greeting(self) -> str:
        """Возвращает приветствие"""
        if self.gender == "male":
            address = "братец"
        elif self.gender == "female":
            address = "голубушка"
        else:
            address = "друг мой"
        
        name = f", {self.user_name}" if self.user_name else ""
        return f"Привет{name}, {address}! Я Фреди, великий комбинатор. Чую в тебе что-то особенное. Любовь, деньги, слава или бананы? 🎭"
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Обрабатывает вопрос пользователя через DeepSeek
        """
        self.last_tools_used = []
        
        # Сохраняем вопрос в историю
        self.conversation_history.append(f"Пользователь: {question}")
        
        # Проверяем, не хочет ли пользователь тест
        if re.search(r"(да|хочу|давай|рискну|сыграем|тест|давай тест|ок|хорошо|погнали)", question.lower()):
            if self.dialog_stage in ["greeting", "exploration", "test_offered"]:
                self.dialog_stage = "test_offered"
                self.last_tools_used.append("test_start")
                return {
                    "response": "Отлично! Тогда первый вопрос...",
                    "tools_used": self.last_tools_used,
                    "follow_up": False,
                    "suggestions": [],
                    "hypnotic_suggestion": False,
                    "tale_suggested": False,
                    "start_test": True
                }
        
        # Проверяем на отказ
        if re.search(r"(нет|не хочу|потом|отстань|не надо|не нужно)", question.lower()):
            self.dialog_stage = "exploration"
            self.last_tools_used.append("refusal_handling")
            # Не вызываем DeepSeek для отказов, используем шаблон
            address = "братец" if self.gender == "male" else "голубушка" if self.gender == "female" else "друг мой"
            response = f"{address}, не хочешь — не надо. Дверь открыта. Но знаешь, твой вопрос никуда не денется. Он будет возвращаться, пока ты не найдёшь ответ. А пока... о чём ещё поговорим?"
            self.conversation_history.append(f"Фреди: {response}")
            return {
                "response": response,
                "tools_used": self.last_tools_used,
                "follow_up": True,
                "suggestions": ["Расскажи о себе", "Что тебя беспокоит?", "О чём хочешь поговорить?"],
                "hypnotic_suggestion": False,
                "tale_suggested": False
            }
        
        # Для всех остальных случаев — вызываем DeepSeek
        try:
            prompt = self._build_prompt(question)
            response = call_deepseek(prompt, max_tokens=200, temperature=0.85)
            
            if not response:
                raise Exception("DeepSeek вернул пустой ответ")
            
            # Очищаем ответ от лишнего
            response = response.strip()
            
            # Обновляем стадию диалога
            if self.dialog_stage == "greeting":
                self.dialog_stage = "exploration"
            
            self.last_tools_used.append("deepseek")
            
        except Exception as e:
            logger.error(f"DeepSeek error in BasicMode: {e}")
            # Fallback ответ
            address = "братец" if self.gender == "male" else "голубушка" if self.gender == "female" else "друг мой"
            response = f"{address}, интересный вопрос... Знаешь, чтобы ответить на него точно, нужно знать твой психологический код. Есть тест — 15 минут. Рискнёшь?"
            self.last_tools_used.append("fallback")
        
        # Сохраняем ответ в историю
        self.conversation_history.append(f"Фреди: {response}")
        
        # Ограничиваем историю
        if len(self.conversation_history) > 20:
            self.conversation_history = self.conversation_history[-20:]
        
        return {
            "response": response,
            "tools_used": self.last_tools_used,
            "follow_up": True,
            "suggestions": ["Любовь", "Деньги", "Слава", "Бананы"],
            "hypnotic_suggestion": False,
            "tale_suggested": False
        }
    
    async def process_question_streaming(self, question: str):
        """
        Потоковая обработка вопроса через DeepSeek
        """
        prompt = self._build_prompt(question)
        
        try:
            async for chunk in call_deepseek_streaming(prompt, max_tokens=200, temperature=0.85):
                yield chunk
        except Exception as e:
            logger.error(f"Streaming error in BasicMode: {e}")
            address = "братец" if self.gender == "male" else "голубушка" if self.gender == "female" else "друг мой"
            yield f"{address}, интересно... Хочешь узнать свой код? Есть тест. 15 минут. Рискнёшь?"
    
    def __repr__(self) -> str:
        return f"<BasicMode(user_id={self.user_id}, stage={self.dialog_stage})>"
