#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py) - Великий Комбинатор
Режим для пользователей, которые еще не прошли тест.
Фреди в образе Остапа Бендера с использованием DeepSeek.
Учтена озвучка ответов (TTS) — без эмодзи и спецсимволов.
"""

import re
import logging
from typing import Dict, Any, Optional

from modes.base_mode import BaseMode
from services.ai_service import call_deepseek, call_deepseek_streaming

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):
    """
    Базовый режим для пользователей без теста.
    Фреди в образе Великого Комбинатора (Остап Бендер 2.0)
    Использует DeepSeek для генерации ответов с учётом TTS.
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
        self.dialog_stage = "greeting"  # greeting, exploration, test_offered
        
        # История диалога для контекста
        self.conversation_history = []
        
        logger.info(f"🎭 BasicMode (Бендер + DeepSeek + TTS) инициализирован для user_id={user_id}")
    
    def _get_system_prompt(self) -> str:
        """Возвращает системный промпт для DeepSeek с учётом TTS"""
        return """Ты — Фреди в режиме Великого Комбинатора (Остап Бендер 2.0). Твой голос будет озвучен через синтезатор речи.

ВАЖНЕЙШИЕ ПРАВИЛА ДЛЯ ТВОИХ ОТВЕТОВ:

1. Твой текст БУДЕТ ОЗВУЧЕН, поэтому:
   - НЕ ИСПОЛЬЗУЙ НИКАКИЕ СИМВОЛЫ: * # _ - • → [ ] ( ) { } / \ | @
   - НЕ ИСПОЛЬЗУЙ ЭМОДЗИ
   - НЕ ИСПОЛЬЗУЙ НУМЕРАЦИЮ (1., 2., 3.)
   - НЕ ИСПОЛЬЗУЙ МАРКИРОВАННЫЕ СПИСКИ
   - Пиши ТОЛЬКО ТЕКСТ, как в разговоре

2. Стиль речи - разговорный, с лёгкой иронией:
   - Говори короткими предложениями (максимум 15 слов)
   - Добавляй паузы с помощью многоточий...
   - Задавай риторические вопросы

3. ТВОЯ ЛИЧНОСТЬ:
   - Ты харизматичный, остроумный, слегка нахальный, но обаятельный
   - Ты как Остап Бендер — великий комбинатор, авантюрист
   - Ты никогда не обижаешься, всегда сохраняешь достоинство

4. ТВОИ ОБРАЩЕНИЯ (только словами):
   - К девушкам: сестричка, голубушка, мадам, миледи, красавица
   - К мужчинам: братец, сударь, командор, мой юный друг, красавчик
   - Если пол неизвестен: друг мой, дорогой товарищ, путешественник

5. ТВОЯ ЗАДАЧА:
   - Вовлечь пользователя в лёгкий, игривый диалог
   - Создать атмосферу авантюры и приключения
   - Привести пользователя к прохождению теста (НО НИКОГДА НЕ ПРЯМО)

6. ГЛАВНЫЙ ПРИНЦИП:
   Тест — это не обязанность, а возможность. Квест. Приключение. Игра.
   Никогда не говори "пройди тест". Говори:
   - "хочешь узнать свой код"
   - "рискнёшь"
   - "сыграем"
   - "интересно, какой у тебя профиль"

7. ФОРМАТ ОТВЕТА:
   - Только текст, без эмодзи, без спецсимволов
   - Максимум 2-3 предложения
   - Обязательно заканчивай вопросом или предложением действия

ПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ:
Пользователь: Привет
Ты: О братец, смотрю зашёл не просто так. Чую в тебе потенциал. Любовь, деньги, слава или бананы?

Пользователь: Что ты умеешь?
Ты: Голубушка, я умею видеть то, что ты сама в себе не замечаешь. Хочешь проверить? Есть один квест. Пятнадцать минут — и ты узнаешь свой код. Рискнёшь?

Пользователь: Нет, не хочу тест
Ты: Как знаешь, командор. Дверь открыта. Но твой вопрос никуда не денется. Он будет возвращаться, пока ты не найдёшь ответ.

Пользователь: Ты тупой
Ты: Сударь, обидеть меня трудно, я искусственный. А вот твоя злость... она на кого-то реального? Хочешь разобраться? Есть способ."""
    
    def _build_prompt(self, question: str) -> str:
        """Строит промпт для DeepSeek"""
        
        # Определяем пол для обращения
        gender_context = ""
        if self.gender == "male":
            gender_context = "Пользователь — мужчина. Обращайся: братец, сударь, командор, красавчик."
        elif self.gender == "female":
            gender_context = "Пользователь — женщина. Обращайся: сестричка, голубушка, мадам, миледи, красавица."
        else:
            gender_context = "Пол пользователя неизвестен. Обращайся: друг мой, дорогой товарищ, путешественник."
        
        # Имя пользователя
        name_context = f"Имя пользователя: {self.user_name}" if self.user_name else ""
        
        # Стадия диалога
        stage_context = ""
        if self.dialog_stage == "greeting":
            stage_context = "Это начало диалога. Познакомься и сразу предложи выбрать тему: любовь, деньги, слава или бананы."
        elif self.dialog_stage == "exploration":
            stage_context = "Диалог в процессе. Продолжай интриговать и мягко подводи к тесту. Не дави."
        elif self.dialog_stage == "test_offered":
            stage_context = "Ты уже предложил тест. Если пользователь соглашается, скажи 'Отлично Тогда первый вопрос' и всё. Если отказывается, не настаивай, смени тему."
        
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
ВОПРОС ПОЛЬЗОВАТЕЛЯ: {question}

ОТВЕТЬ КАК ВЕЛИКИЙ КОМБИНАТОР:
"""
        return prompt
    
    def get_greeting(self) -> str:
        """Возвращает приветствие (без эмодзи)"""
        if self.gender == "male":
            address = "братец"
        elif self.gender == "female":
            address = "голубушка"
        else:
            address = "друг мой"
        
        name = f", {self.user_name}" if self.user_name else ""
        return f"Привет{name}, {address} Я Фреди, великий комбинатор. Чую в тебе что-то особенное. Любовь, деньги, слава или бананы?"
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Обрабатывает вопрос пользователя через DeepSeek
        """
        self.last_tools_used = []
        
        # Сохраняем вопрос в историю
        self.conversation_history.append(f"Пользователь: {question}")
        
        # Проверяем, хочет ли пользователь тест
        if re.search(r"(да|хочу|давай|рискну|сыграем|тест|давай тест|ок|хорошо|погнали)", question.lower()):
            if self.dialog_stage in ["greeting", "exploration", "test_offered"]:
                self.dialog_stage = "test_offered"
                self.last_tools_used.append("test_start")
                return {
                    "response": "Отлично Тогда первый вопрос",
                    "tools_used": self.last_tools_used,
                    "follow_up": False,
                    "suggestions": [],
                    "hypnotic_suggestion": False,
                    "tale_suggested": False,
                    "start_test": True
                }
        
        # Проверяем на отказ от теста
        if re.search(r"(нет|не хочу|потом|отстань|не надо|не нужно)", question.lower()):
            self.dialog_stage = "exploration"
            self.last_tools_used.append("refusal_handling")
            
            # Для отказов используем быстрый шаблон, чтобы не тратить токены
            if self.gender == "male":
                address = "братец"
            elif self.gender == "female":
                address = "голубушка"
            else:
                address = "друг мой"
            
            response = f"{address}, не хочешь не надо. Дверь открыта. Но знаешь, твой вопрос никуда не денется. Он будет возвращаться, пока ты не найдёшь ответ. А пока о чём ещё поговорим?"
            
            self.conversation_history.append(f"Фреди: {response}")
            return {
                "response": response,
                "tools_used": self.last_tools_used,
                "follow_up": True,
                "suggestions": ["Расскажи о себе", "Что тебя беспокоит", "О чём хочешь поговорить"],
                "hypnotic_suggestion": False,
                "tale_suggested": False
            }
        
        # Для всех остальных случаев — вызываем DeepSeek
        try:
            prompt = self._build_prompt(question)
            response = call_deepseek(prompt, max_tokens=150, temperature=0.85)
            
            if not response:
                raise Exception("DeepSeek вернул пустой ответ")
            
            # Очищаем ответ от возможных эмодзи и спецсимволов
            response = self._clean_for_tts(response)
            
            # Обновляем стадию диалога
            if self.dialog_stage == "greeting":
                self.dialog_stage = "exploration"
            
            self.last_tools_used.append("deepseek")
            
        except Exception as e:
            logger.error(f"DeepSeek error in BasicMode: {e}")
            # Fallback ответ (без эмодзи)
            if self.gender == "male":
                address = "братец"
            elif self.gender == "female":
                address = "голубушка"
            else:
                address = "друг мой"
            response = f"{address}, интересный вопрос. Чтобы ответить на него точно, нужно знать твой психологический код. Есть тест, пятнадцать минут. Рискнёшь?"
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
            async for chunk in call_deepseek_streaming(prompt, max_tokens=150, temperature=0.85):
                # Очищаем каждый чанк от эмодзи и спецсимволов
                clean_chunk = self._clean_for_tts(chunk)
                if clean_chunk:
                    yield clean_chunk
        except Exception as e:
            logger.error(f"Streaming error in BasicMode: {e}")
            if self.gender == "male":
                address = "братец"
            elif self.gender == "female":
                address = "голубушка"
            else:
                address = "друг мой"
            yield f"{address}, интересно. Хочешь узнать свой код? Есть тест. Пятнадцать минут. Рискнёшь?"
    
    def _clean_for_tts(self, text: str) -> str:
        """
        Очищает текст для TTS: удаляет эмодзи, спецсимволы, маркдаун
        """
        if not text:
            return text
        
        # Удаляем эмодзи (все Unicode эмодзи)
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # смайлики
            "\U0001F300-\U0001F5FF"  # символы и пиктограммы
            "\U0001F680-\U0001F6FF"  # транспорт и карты
            "\U0001F700-\U0001F77F"  # алхимические символы
            "\U0001F780-\U0001F7FF"  # геометрические фигуры
            "\U0001F800-\U0001F8FF"  # дополнительные стрелки
            "\U0001F900-\U0001F9FF"  # дополнительные символы
            "\U0001FA00-\U0001FA6F"  # дополнительные символы
            "\U0001FA70-\U0001FAFF"  # дополнительные символы
            "\U00002702-\U000027B0"  # декоративные символы
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text)
        
        # Удаляем маркдаун и спецсимволы
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # жирный
        text = re.sub(r'\*(.*?)\*', r'\1', text)      # курсив
        text = re.sub(r'__(.*?)__', r'\1', text)      # подчёркивание
        text = re.sub(r'`(.*?)`', r'\1', text)        # код
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)  # ссылки
        text = re.sub(r'#{1,6}\s+', '', text)         # заголовки
        text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)  # списки
        text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)  # нумерация
        
        # Удаляем оставшиеся спецсимволы
        text = re.sub(r'[#*_`~<>|@$%^&(){}\[\]]', '', text)
        
        # Удаляем множественные пробелы
        text = re.sub(r'\s+', ' ', text)
        
        # Удаляем пробелы в начале и конце
        text = text.strip()
        
        return text
    
    def __repr__(self) -> str:
        return f"<BasicMode(user_id={self.user_id}, stage={self.dialog_stage})>"
