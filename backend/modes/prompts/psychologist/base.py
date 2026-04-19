#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Базовый класс для психотерапевтических методов.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class TherapyMethod:
    """Базовый класс для психотерапевтического метода."""
    
    # Идентификаторы
    code: str                              # "cbt", "logo", "psychoanalysis"...
    name_ru: str                           # "Когнитивно-поведенческая терапия"
    author_name: str                       # "Аарон Бек"
    author_years: str                      # "1921–2021"
    
    # Для прозрачности и UI
    short_description: str                 # для бейджа
    introduction_template: str             # вступительное сообщение
    
    # LLM-промпт
    system_prompt: str
    fewshot: List[Dict[str, str]] = field(default_factory=list)
    
    # Параметры генерации
    temperature: float = 0.6
    top_p: float = 0.9
    max_tokens: int = 1200
    frequency_penalty: float = 0.3
    
    def introduction_message(self) -> str:
        """Возвращает вступительное сообщение автора."""
        return self.introduction_template
    
    def build_messages(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        is_first_turn: bool = False
    ) -> List[Dict[str, str]]:
        """
        Строит список сообщений для API.
        
        Args:
            user_message: Текущее сообщение пользователя
            history: История диалога (список с role и content)
            is_first_turn: Первое ли сообщение в сессии
        
        Returns:
            Список сообщений в формате OpenAI
        """
        messages = [{"role": "system", "content": self.system_prompt}]
        
        # Добавляем few-shot только если это первый ход
        if is_first_turn and self.fewshot:
            messages.extend(self.fewshot)
        
        # Добавляем историю (последние N сообщений)
        if history:
            # Берём последние 20 сообщений (10 обменов)
            recent_history = history[-20:] if len(history) > 20 else history
            messages.extend(recent_history)
        
        # Добавляем текущее сообщение
        messages.append({"role": "user", "content": user_message})
        
        return messages
    
    def api_params(self) -> Dict[str, float]:
        """Возвращает параметры для вызова API."""
        return {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "max_tokens": self.max_tokens,
            "frequency_penalty": self.frequency_penalty,
        }
