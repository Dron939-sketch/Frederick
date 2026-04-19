#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Гибридный Router для классификации психотерапевтических запросов.
Регулярки + LLM-классификатор.
"""

import json
import re
from typing import Dict, List, Optional, Any

# ============================================================
# КРИТЕРИИ ДЛЯ БЫСТРОЙ КЛАССИФИКАЦИИ (регулярки)
# ============================================================

QUICK_RULES: Dict[str, List[str]] = {
    "cbt": [
        r"\bтревог\w*", r"\bпаник\w*", r"\bфоби\w*",
        r"\bнакручива\w*", r"\bкатастроф\w*",
        r"\bа вдруг\b", r"\bбоюсь что\b",
        r"\bавтоматическ\w* мысл\w*", r"\bкогнитивн\w* искаж\w*",
        r"\bстрах\w*", r"\bбоязн\w*",
    ],
    "logo": [
        r"\bсмысл\w*", r"\bзачем жить\b", r"\bпотерял\w*",
        r"\bумер\w*", r"\bгор[ея]\b", r"\bпохорон\w*",
        r"\bдиагноз\b", r"\bне могу (это )?изменить\b",
        r"\bсмертельн\w* болезн\w*", r"\bутрат\w*",
    ],
    "existential": [
        r"\bстрах смерти\b", r"\bбоюсь смерти\b",
        r"\bодиночеств\w* среди\b", r"\bсвобод\w* пугает\b",
        r"\bбессмысленн\w*", r"\bпустот\w* существовани\w*",
        r"\bэкзистенци\w*", r"\bсмысл существовани\w*",
    ],
    "analytical": [
        r"\bсон\b", r"\bснит\w*", r"\bприснил\w*", r"\bсны\b",
        r"\bсимвол\w*", r"\bархетип\w*",
        r"\bкризис средн\w*", r"\bмифологич\w*",
        r"\bюнг\w*", r"\bбессознательн\w* коллективн\w*",
    ],
    "psychoanalysis": [
        r"\bдетств\w*", r"\bродител\w*", r"\bмама\b", r"\bпапа\b",
        r"\bотец\b", r"\bмать\b",
        r"\bповторя\w*", r"\bодинаков\w* партнёр\w*",
        r"\bодни и те же отношени\w*", r"\bфрейд\w*",
        r"\bбессознательн\w*", r"\bвытесн\w*",
    ],
    "gestalt": [
        r"\bне могу отпустить\b", r"\bнезаконченн\w*",
        r"\bзастрял\w*", r"\bнедоговорил\w*",
        r"\bтело говорит\b", r"\bне могу закрыть\b",
        r"\bгештальт\w*", r"\bздесь и сейчас\b",
    ],
    "transactional": [
        r"\bсценари\w*", r"\bодни и те же роли\b",
        r"\bловушк\w*", r"\bигра в отношени\w*",
        r"\bроль (спасател|жертв|преследовател)\w*",
        r"\bтранзактн\w*", r"\bберн\w*",
        r"\bэго-состоян\w*",
    ],
}

# ============================================================
# МАРКЕРЫ СМЕНЫ МЕТОДА
# ============================================================

CHANGE_METHOD_PATTERNS: List[str] = [
    r"\bдавай(те)? (по-?другому|иначе|другой подход)",
    r"\bэто не работает\b",
    r"\bхочу (другой|иначе|по-?другому|сменить)",
    r"\bпопробу(ем|й) (другой|иначе|по-?другому)",
    r"\bмне не подходит\b",
    r"\bсменим (подход|метод)\b",
    r"\bне помогает\b",
    r"\bдавай(те) друг(ой|ое)\b",
]

# ============================================================
# КРИЗИСНЫЕ МАРКЕРЫ
# ============================================================

CRISIS_MARKERS: List[str] = [
    r"\bне хочу жить\b", r"\bсамоубийств\w*", r"\bпокончить с собой\b",
    r"\bжизнь не имеет смысла\b", r"\bне могу больше\b",
    r"\bпомогите\b", r"\bкризис\b",
]

# ============================================================
# LLM-КЛАССИФИКАТОР
# ============================================================

LLM_CLASSIFIER_SYSTEM_PROMPT = """Ты классификатор психотерапевтических запросов.
Проанализируй сообщение пользователя и верни СТРОГО JSON без обрамления:
{"category": "cbt|logo|existential|analytical|psychoanalysis|gestalt|transactional|person_centered",
 "confidence": 0.0-1.0,
 "reason": "одно предложение на русском"}

Категории и их триггеры:
- cbt — тревога, фобии, когнитивные искажения, конкретные симптомы, 
  автоматические негативные мысли, паника, навязчивости
- logo — потеря смысла, горе, необратимое страдание, тяжёлая болезнь, 
  обстоятельства, которые нельзя изменить, утрата
- existential — страх смерти, парализующая свобода, одиночество как данность, 
  вопросы о природе существования, экзистенциальная пустота
- analytical — сны, символы, архетипические образы, кризис середины жизни, 
  «тянет к чему-то необъяснимо», мифологические мотивы
- psychoanalysis — детство, родители, повторяющиеся паттерны в отношениях, 
  бессознательная тяга, оговорки, повторение травмы
- gestalt — незавершённое, «не могу отпустить», застревание в эпизоде, 
  работа с телом и «здесь-и-сейчас», незакрытый гештальт
- transactional — сценарии в отношениях, роли, «игры», повторяющиеся 
  конфликтные сюжеты, треугольник Карпмана
- person_centered — потребность быть выслушанным, неясный запрос, 
  эмоциональная перегрузка без конкретики, просто нужда в поддержке

Если ни одна категория не подходит уверенно — верни person_centered с confidence < 0.5."""


# ============================================================
# ОСНОВНЫЕ ФУНКЦИИ
# ============================================================

def detect_change_request(user_message: str) -> bool:
    """Определить, просит ли пользователь сменить метод."""
    text = user_message.lower()
    return any(re.search(p, text) for p in CHANGE_METHOD_PATTERNS)


def has_crisis_marker(user_message: str) -> bool:
    """Определить, есть ли кризисный маркер."""
    text = user_message.lower()
    return any(re.search(p, text) for p in CRISIS_MARKERS)


def quick_classify(user_message: str) -> Optional[str]:
    """
    Быстрая классификация по регуляркам.
    
    Returns:
        Код метода или None, если неоднозначно
    """
    text = user_message.lower()
    scores: Dict[str, int] = {}
    
    for category, patterns in QUICK_RULES.items():
        hits = sum(1 for p in patterns if re.search(p, text))
        if hits > 0:
            scores[category] = hits
    
    if not scores:
        return None
    
    # Сортируем по убыванию
    sorted_scores = sorted(scores.items(), key=lambda x: -x[1])
    
    # Если явный лидер (разница с остальными >= 2) — вернуть
    if len(sorted_scores) == 1 or sorted_scores[0][1] - sorted_scores[1][1] >= 2:
        return sorted_scores[0][0]
    
    return None  # Неоднозначно — в LLM


async def llm_classify(
    user_message: str,
    deepseek_client,
    timeout: float = 3.0
) -> Dict[str, Any]:
    """
    Классификация через LLM.
    
    Args:
        user_message: Сообщение пользователя
        deepseek_client: Клиент для вызова DeepSeek (AIService)
        timeout: Таймаут в секундах
    
    Returns:
        Словарь с category, confidence, reason
    """
    import asyncio
    try:
        # Вызов с таймаутом
        async def _call():
            response = await deepseek_client._call_deepseek(
                system_prompt=LLM_CLASSIFIER_SYSTEM_PROMPT,
                user_prompt=user_message,
                max_tokens=150,
                temperature=0.2,
            )
            if not response:
                raise ValueError("empty response")
            return response
        
        response = await asyncio.wait_for(_call(), timeout=timeout)
        text = response.strip()
        
        # Очистка от markdown-обёртки
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        
        result = json.loads(text)
        
        # Валидация
        valid_categories = {
            "cbt", "logo", "existential", "analytical",
            "psychoanalysis", "gestalt", "transactional", "person_centered"
        }
        
        category = result.get("category", "person_centered")
        if category not in valid_categories:
            category = "person_centered"
        
        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))  # Ограничиваем
        
        return {
            "category": category,
            "confidence": confidence,
            "reason": result.get("reason", "классификация через LLM"),
        }
        
    except asyncio.TimeoutError:
        return {
            "category": "person_centered",
            "confidence": 0.3,
            "reason": "таймаут классификатора",
        }
    except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
        return {
            "category": "person_centered",
            "confidence": 0.3,
            "reason": f"ошибка классификатора: {type(e).__name__}",
        }


async def classify(
    user_message: str,
    history: List[Dict[str, str]] = None,
    exclude_methods: List[str] = None,
    deepseek_client = None,
    confidence_threshold: float = 0.45,
) -> Dict[str, Any]:
    """
    Основная функция Router. Гибридная классификация.
    
    Args:
        user_message: Текущее сообщение пользователя
        history: История диалога (опционально, пока не используется)
        exclude_methods: Список методов для исключения
        deepseek_client: Клиент DeepSeek (обязателен для LLM-классификации)
        confidence_threshold: Порог уверенности для LLM
    
    Returns:
        Словарь с method_code, confidence, reason, source
    """
    exclude_methods = exclude_methods or []
    
    # Шаг 1: быстрая классификация по регуляркам
    quick = quick_classify(user_message)
    if quick and quick not in exclude_methods:
        return {
            "method_code": quick,
            "confidence": 0.9,
            "reason": "точное совпадение по ключевым маркерам",
            "source": "regex",
        }
    
    # Шаг 2: LLM-классификация (если есть клиент)
    if deepseek_client:
        llm_result = await llm_classify(user_message, deepseek_client)
        
        # Шаг 3: проверка порога и исключений
        if (llm_result["confidence"] >= confidence_threshold
                and llm_result["category"] not in exclude_methods):
            return {
                "method_code": llm_result["category"],
                "confidence": llm_result["confidence"],
                "reason": llm_result["reason"],
                "source": "llm",
            }
    
    # Шаг 4: fallback на Роджерса
    return {
        "method_code": "person_centered",
        "confidence": 0.4,
        "reason": "fallback: низкая уверенность или метод исключён",
        "source": "fallback",
    }
