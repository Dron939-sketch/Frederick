#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dream_service.py — Юнгианская интерпретация снов с учётом профиля пользователя
"""

import logging
import re
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

logger = logging.getLogger(__name__)


class DreamInterpretationService:
    """Сервис для интерпретации снов через AI с учётом профиля пользователя"""
    
    def __init__(self, ai_service):
        """
        Args:
            ai_service: Экземпляр AIService для вызовов AI
        """
        self.ai_service = ai_service
    
    MAX_CLARIFICATIONS = 3

    async def interpret_dream(
        self,
        user_id: int,
        dream_text: str,
        user_name: str,
        profile_code: Optional[str] = None,
        perception_type: Optional[str] = None,
        thinking_level: Optional[int] = None,
        vectors: Optional[Dict[str, float]] = None,
        key_characteristic: Optional[str] = None,
        main_trap: Optional[str] = None,
        clarification_answer: Optional[str] = None,
        clarifications: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Интерпретация сна с поддержкой многораундовых уточнений.

        Args:
            dream_text — исходный текст сна.
            clarifications — накопленная история Q&A [{'question': ..., 'answer': ...}, ...].
                             Если не задано, но есть clarification_answer — из него делается псевдо-запись
                             (обратная совместимость со старыми вызовами).

        Returns одно из двух:
            - {'needs_clarification': True, 'session_id', 'question', 'clarification_number': int}
            - {'needs_clarification': False, 'interpretation': str}
        """

        profile_context = self._build_profile_context(
            profile_code=profile_code,
            perception_type=perception_type,
            thinking_level=thinking_level,
            vectors=vectors,
            key_characteristic=key_characteristic,
            main_trap=main_trap
        )

        # Backward-compat: если получен одиночный ответ, но нет истории — сформируем её из _check_needs_clarification
        history: List[Dict[str, str]] = list(clarifications or [])
        if clarification_answer and not history:
            _, inferred_q = self._check_needs_clarification(dream_text)
            history.append({
                "question": inferred_q or "Расскажи подробнее.",
                "answer": clarification_answer
            })

        # Если уже достаточно контекста или лимит уточнений достигнут — в AI.
        next_q = self._next_question(dream_text, history)

        if next_q and len(history) < self.MAX_CLARIFICATIONS:
            return {
                "needs_clarification": True,
                "session_id": f"{user_id}_{int(datetime.now().timestamp())}",
                "question": next_q,
                "clarification_number": len(history) + 1,
                "max_clarifications": self.MAX_CLARIFICATIONS
            }

        prompt = self._build_interpretation_prompt(
            dream_text=dream_text,
            user_name=user_name,
            profile_context=profile_context,
            clarifications=history
        )

        try:
            interpretation = await self.ai_service._call_deepseek(
                system_prompt=self._get_system_prompt(),
                user_prompt=prompt,
                max_tokens=800,
                temperature=0.75
            )
            # Защита от пустого ответа DeepSeek
            if not interpretation or not str(interpretation).strip():
                logger.warning(f"DeepSeek returned empty for user {user_id} — using fallback")
                interpretation = self._get_fallback_interpretation(dream_text, user_name)
            else:
                interpretation = self._clean_response(interpretation)

            return {
                "needs_clarification": False,
                "interpretation": interpretation
            }

        except Exception as e:
            logger.error(f"AI interpretation failed for user {user_id}: {e}")
            return {
                "needs_clarification": False,
                "interpretation": self._get_fallback_interpretation(dream_text, user_name)
            }

    def _next_question(
        self,
        dream_text: str,
        clarifications: List[Dict[str, str]]
    ) -> Optional[str]:
        """
        Определяет следующий уточняющий вопрос на основе всех накопленных данных.
        Возвращает None, если контекста уже достаточно или достигнут лимит раундов.
        """
        if len(clarifications) >= self.MAX_CLARIFICATIONS:
            return None

        # Собираем всё сказанное
        pool_parts = [dream_text] + [c.get("answer", "") for c in clarifications]
        pool = " ".join(pool_parts).strip()
        pool_lower = pool.lower()
        word_count = len(pool.split())

        # Какие вопросы уже задавали (не спрашиваем повторно)
        asked = {(c.get("question") or "").strip().lower() for c in clarifications}

        def ask(q: str) -> Optional[str]:
            return None if q.strip().lower() in asked else q

        # Слишком мало слов суммарно
        if word_count < 30:
            q = ask("Расскажи немного подробнее: что происходило во сне, какие были события?")
            if q:
                return q

        # Нет эмоций
        emotions = ["груст", "радост", "страх", "гнев", "тревог", "спокой", "волнен", "счасть", "обид", "стыд",
                    "любов", "ненавис", "удивл", "ужас", "уютн", "одиноч"]
        if not any(e in pool_lower for e in emotions):
            q = ask("Какие эмоции ты испытывал во сне? Это очень важно для понимания.")
            if q:
                return q

        # Нет персонажей (кроме самого пользователя)
        persons = ["друг", "подруг", "мама", "папа", "женщин", "мужчин", "ребёнк", "ребенк",
                   "знаком", "человек", "люди", "семь", "брат", "сестр"]
        has_only_self = "я " in pool_lower or pool_lower.startswith("я") or "мне " in pool_lower
        if not any(p in pool_lower for p in persons) and not has_only_self:
            q = ask("Кто был в твоём сне? Даже если ты был один — это тоже важно.")
            if q:
                return q

        # Детали/символы после первого раунда
        if len(clarifications) >= 1 and word_count < 80:
            q = ask("Какие детали запомнились ярче всего — цвета, звуки, места, предметы?")
            if q:
                return q

        # Связь с жизнью после второго
        if len(clarifications) >= 2:
            q = ask("Есть ли в твоей реальной жизни сейчас ситуация, которая напоминает этот сон?")
            if q:
                return q

        return None
    
    def _get_system_prompt(self) -> str:
        """Системный промпт для AI"""
        return """Ты — Фреди, мудрый и эмпатичный психолог-юнгианец. 
Ты помогаешь людям понять послания их снов. Говори тепло, но без пафоса. 
Используй обращение на "ты". Не используй сложную терминологию без объяснения.
Твоя задача — дать человеку понять, что его бессознательное хочет ему сказать.

ВАЖНЫЕ ПРАВИЛА:
- Никогда не говори "это точно значит", лучше "возможно, этот сон говорит о..."
- Будь бережным и поддерживающим
- Не навязывай своё мнение
- Учитывай психологический профиль пользователя
- Длина ответа: 200-400 слов
- Пиши на русском языке"""
    
    def _build_profile_context(
        self,
        profile_code: Optional[str] = None,
        perception_type: Optional[str] = None,
        thinking_level: Optional[int] = None,
        vectors: Optional[Dict[str, float]] = None,
        key_characteristic: Optional[str] = None,
        main_trap: Optional[str] = None
    ) -> str:
        """Формирует текстовое описание профиля пользователя"""
        parts = []
        
        if profile_code:
            parts.append(f"Психологический профиль: {profile_code}")
        
        if perception_type:
            parts.append(f"Тип восприятия: {perception_type}")
        
        if thinking_level:
            parts.append(f"Уровень мышления: {thinking_level}/9")
        
        if vectors:
            sb = vectors.get("СБ", 3)
            tf = vectors.get("ТФ", 3)
            ub = vectors.get("УБ", 3)
            cv = vectors.get("ЧВ", 3)
            parts.append(f"Векторы: СБ={sb}/6, ТФ={tf}/6, УБ={ub}/6, ЧВ={cv}/6")
            
            # Определяем самый низкий вектор
            min_vector = min(vectors.items(), key=lambda x: x[1])
            parts.append(f"Самая уязвимая зона: {min_vector[0]} ({min_vector[1]}/6)")
        
        if key_characteristic:
            parts.append(f"Ключевая характеристика: {key_characteristic}")
        
        if main_trap:
            parts.append(f"Главная ловушка: {main_trap}")
        
        return "\n".join(parts) if parts else "Профиль формируется"
    
    def _check_needs_clarification(self, dream_text: str) -> Tuple[bool, Optional[str]]:
        """Проверяет, нужны ли уточняющие вопросы"""
        text_lower = dream_text.lower()
        word_count = len(dream_text.split())
        
        # Слишком короткий сон
        if word_count < 30:
            return True, "Расскажи немного подробнее: что ты чувствовал во сне? Кто ещё там был?"
        
        # Нет эмоций
        emotions = ["грусть", "радость", "страх", "гнев", "тревога", "спокойствие", "волнение", "счастье", "обида", "стыд"]
        if not any(e in text_lower for e in emotions):
            return True, "Какие эмоции ты испытывал во сне? Это важно для понимания."
        
        # Нет персонажей
        persons = ["я", "друг", "подруг", "мама", "папа", "женщин", "мужчин", "ребёнк", "знаком", "человек", "люди"]
        if not any(p in text_lower for p in persons):
            return True, "Кто был в твоём сне? Даже если ты был один — это тоже важно."
        
        return False, None
    
    def _build_interpretation_prompt(
        self,
        dream_text: str,
        user_name: str,
        profile_context: str,
        clarifications: Optional[List[Dict[str, str]]] = None,
        has_clarification: bool = False,
        clarification_answer: Optional[str] = None
    ) -> str:
        """Формирует промпт для AI"""

        clarification_part = ""
        if clarifications:
            lines = []
            for i, qa in enumerate(clarifications, 1):
                q = (qa.get("question") or "").strip()
                a = (qa.get("answer") or "").strip()
                if not a:
                    continue
                lines.append(f"Уточнение {i}:\nВопрос: {q}\nОтвет: {a}")
            if lines:
                clarification_part = "\nДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ОТ ПОЛЬЗОВАТЕЛЯ:\n" + "\n\n".join(lines) + "\n"
        elif has_clarification and clarification_answer:
            clarification_part = f"""
ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ОТ ПОЛЬЗОВАТЕЛЯ:
{clarification_answer}
"""
        
        return f"""
ПОЛЬЗОВАТЕЛЬ:
Имя: {user_name}
{profile_context}

СОН ПОЛЬЗОВАТЕЛЯ:
{dream_text}
{clarification_part}

ТВОЯ ЗАДАЧА:
Дай тёплую, глубокую, но понятную интерпретацию этого сна.

СТРУКТУРА ОТВЕТА:
1. Тёплое обращение к пользователю (используй его имя)
2. Главный посыл сна — что бессознательное хочет сказать
3. Ключевые образы и их значение (простыми словами)
4. Связь с профилем пользователя (как сон связан с его жизнью)
5. Конкретный вопрос для размышления или маленькое задание
6. Поддерживающая фраза в конце

Напиши ответ:"""
    
    def _clean_response(self, text: str) -> str:
        """Очищает ответ AI от маркдауна и лишних символов"""
        # Убираем markdown
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        text = re.sub(r'#+\s*', '', text)
        
        # Убираем лишние пробелы и переносы
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        
        return text
    
    def _get_fallback_interpretation(self, dream_text: str, user_name: str) -> str:
        """Запасная интерпретация, если AI недоступен"""
        return f"""{user_name}, спасибо, что поделился сном.

Сны — это язык нашего бессознательного. В твоём сне есть важные образы, которые заслуживают внимания.

Попробуй задать себе эти вопросы:
• Что я чувствовал во сне?
• С какими ситуациями в жизни это может быть связано?
• Что мой сон пытается мне сказать?

Запиши свои мысли и возвращайся к ним через несколько дней. Часто ответ приходит не сразу, а когда мы немного отстраняемся.

Я здесь, чтобы помочь тебе разобраться. Попробуй рассказать сон ещё раз, добавив больше деталей — что ты чувствовал, кто был рядом, какие цвета и звуки запомнились.

Ты справишься. 💫"""


# ============================================
# ФАБРИКА ДЛЯ СОЗДАНИЯ СЕРВИСА
# ============================================

def create_dream_service(ai_service) -> DreamInterpretationService:
    """Создаёт экземпляр сервиса интерпретации снов"""
    return DreamInterpretationService(ai_service)
