"""Мысли психолога: обращение с большой буквы и разбор не в одну строку.

17.09.2026 владелец показал экран: «друг, ты часто ставишь интересы
других выше своих. Где та грань…» — одно предложение и обращение со
строчной буквы. Обе причины разные.

Строчная «друг» — из format_psychologist_text: он приписывает обращение
и понижает первую букву текста. Для настоящего имени это верно («Анна,
ты часто…»), а запасное «друг» приходит со строчной и таким и остаётся.

Одно предложение — это запасной текст: в промпте просили «1 предложение»
на раздел, а на экране был вовсе не он, а хардкод из _get_thought_fallback.
"""

import ast
import pathlib
import re
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from formatters import format_psychologist_text  # noqa: E402

AI_SRC = (BACKEND / "services" / "ai_service.py").read_text(encoding="utf-8")


def test_address_is_capitalized():
    """«друг» становится «Друг» — обращение открывает предложение."""
    out = format_psychologist_text("Ты часто ставишь интересы выше своих.", "друг")
    assert out.startswith("Друг, ты часто"), out[:40]


def test_real_name_still_works():
    """Настоящее имя не ломается."""
    out = format_psychologist_text("Ты часто ставишь интересы выше своих.", "Анна")
    assert out.startswith("Анна, ты часто"), out[:40]


def test_no_address_without_name():
    """Без имени обращение не приписывается вовсе."""
    out = format_psychologist_text("Ты часто ставишь интересы выше своих.", "")
    assert out.startswith("Ты часто"), out[:40]


def test_prompt_asks_for_several_sentences():
    """Промпт просит 2–3 предложения на раздел, а не одно."""
    assert "в каждом 2–3 предложения" in AI_SRC
    assert "🔐 КЛЮЧЕВОЙ ЭЛЕМЕНТ — (1 предложение)" not in AI_SRC


def test_token_ceiling_raised():
    """1400 токенов: на 500 текст обрывался бы на четвёртом разделе."""
    m = re.search(r"generate_psychologist_thought.*?max_tokens=(\d+)", AI_SRC, re.S)
    assert m and int(m.group(1)) >= 1200, "потолок токенов не поднят"


def test_fallback_does_not_pose_as_personal_analysis():
    """Запасной текст честно говорит, что он общий, и зовёт пересобрать.

    Сам текст с 17.09.2026 лежит в константе THOUGHT_FALLBACK, а не в
    теле метода: его понадобилось узнавать снаружи, чтобы не сохранять
    в базу.
    """
    src = AI_SRC.split("THOUGHT_FALLBACK = (")[1].split(")\n")[0]
    assert "не про тебя лично" in src, "запасной текст выдаёт себя за разбор"
    assert "Новая мысль" in src, "нет выхода — как получить свою мысль"


def test_fallback_is_never_persisted():
    """Заглушка не попадает в базу — иначе она закрепляется навсегда.

    17.09.2026: все четыре места вызова сохраняли всё, что вернул
    генератор, а чтение устроено «есть запись — значит готово». Один
    сетевой сбой закреплял за человеком текст «связь с моделью подвела»
    насовсем: он уходил на экран, в письмо и в PDF.
    """
    import pathlib
    repo = (pathlib.Path(__file__).resolve().parents[1]
            / "repositories" / "user_repo.py").read_text(encoding="utf-8")
    save = repo.split("async def save_psychologist_thought")[1].split("async def ")[0]
    assert "is_thought_fallback(thought)" in save, "заглушка снова пишется в базу"
    assert "return None" in save


def test_stored_fallback_heals_itself():
    """Уже записанная заглушка читается как «нет мысли» и пересобирается."""
    import pathlib
    main = (pathlib.Path(__file__).resolve().parents[1]
            / "main.py").read_text(encoding="utf-8")
    assert "not thought or is_thought_fallback(thought)" in main
    assert "if is_thought_fallback(psychologist_thought):" in main


def test_generators_do_not_pay_for_invisible_reasoning():
    """У генераторов структурированного текста размышление выключено.

    17.09.2026, живые данные. Двое прошли тест в 16:39 и 16:51. Оба
    получили вместо мысли психолога заглушку, а у второго весь разбор
    свёлся к двадцати знакам — одному заголовку «🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ».
    У первого при этом разбор в ту же минуту собрался на 2500 знаков:
    модель отвечала, дело было не в сбое.

    Разница между вызовами — только бюджет: разбор просил 3500 токенов,
    мысль 1400. Невидимые рассуждения съедали его раньше, чем начинался
    ответ. Обдумывать в этих вызовах нечего — промпт короткий, схема
    ответа готовая, — поэтому thinking=False у всех шести.
    """
    for fn in ("generate_ai_profile", "generate_psychologist_thought",
               "generate_test_recommendations", "generate_questions",
               "generate_goals", "generate_weekend_ideas"):
        body = AI_SRC.split(f"def {fn}(")[1].split("\n    async def ")[0]
        call = body.split("_call_deepseek(")[1].split(")")[0]
        assert "thinking=False" in call, (
            f"{fn}: размышление съест бюджет и ответ придёт пустым")


def test_truncated_profile_is_not_saved():
    """Оборванный разбор не закрепляется в базе навсегда.

    Проверка была на «текст есть», а не на «текст целый», и заголовок в
    двадцать знаков прошёл сквозь неё. Непустое поле означает «уже
    готово» — перегенерации после этого не происходит никогда.
    """
    import sys, pathlib as pl
    sys.path.insert(0, str(pl.Path(__file__).resolve().parents[1]))
    from services.ai_service import profile_looks_complete
    assert not profile_looks_complete("🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ")
    assert not profile_looks_complete("")
    assert not profile_looks_complete(None)
    whole = ("🪞 ЭТО ПРО ТЕБЯ, ЕСЛИ\n" + "текст. " * 120 +
             "\n💪 ЧТО У ТЕБЯ СИЛЬНОГО\n" + "текст. " * 40 +
             "\n⚠️ ЧЕМ ЭТО ОБХОДИТСЯ\n" + "текст. " * 40 +
             "\n🎯 ГЛАВНЫЙ УЗЕЛ\n" + "текст. " * 40)
    assert profile_looks_complete(whole)
