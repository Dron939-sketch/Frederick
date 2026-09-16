"""Письмо с результатом коротких тестов сайта — и адрес, который остаётся.

Зачем это есть. Большой тест внутри приложения спрашивает почту на
знакомстве и шлёт PDF-разбор; короткие тесты на сайте (PHQ-9, GAD-7,
ревность, умение любить) не спрашивали ничего. За неделю 15.09.2026 они
дали 84 прохождения против 52 стартов большого теста — вдвое больше
людей, и ни одного адреса. Человек читал результат и уходил навсегда:
позвать его обратно было нечем.

Почему тексты живут здесь, а не приходят со страницы. Страница могла бы
прислать готовый разбор, и письмо совпадало бы с экраном слово в слово.
Но тогда любой, кто нашёл адрес ручки, рассылал бы нашим именем что
угодно: открытый ретранслятор. Поэтому клиент присылает только ключ
теста, полосу результата и балл; текст письма собирается здесь, из
нашего каталога, и подделать его нельзя.

Курсы, игры и книги — те же, что человек видит на странице теста.
Названия и адреса не выдумываются: они списаны с recsFor() каждой
страницы (`testy/<тест>/index.html`), и при переименовании курса
править надо обе стороны.
"""

from __future__ import annotations

from html import escape
from typing import Any, Dict, List, Optional, Tuple

SITE = "https://meysternlp.ru"
FREDI_URL = SITE + "/fredi/"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS fredi_test_leads (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    test TEXT NOT NULL,
    band TEXT,
    score INTEGER,
    opt_out_token TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    followed_up_at TIMESTAMP WITH TIME ZONE,
    opted_out_at TIMESTAMP WITH TIME ZONE
)
"""

CREATE_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS idx_test_leads_followup "
    "ON fredi_test_leads (created_at) WHERE followed_up_at IS NULL"
)


def _rec(title: str, url: str, fmt: str, why: str) -> Dict[str, str]:
    return {"title": title, "url": url, "fmt": fmt, "why": why}


# Курс тревоги, КПТ и игры повторяются в нескольких тестах — так и на
# страницах: одна и та же тревога лечится одним и тем же.
_TREVOGA = _rec("Курс «Тревога и как с ней жить»", "/blog/lektorij/trevoga/",
                "Бесплатно, без регистрации",
                "Как устроено беспокойство, которое не выключается, и что с ним делают.")
_KPT = _rec("Курс «КПТ самостоятельно»", "/blog/lektorij/kpt-samostoyatelno/",
            "Бесплатно",
            "Рабочий метод против раскручивающихся мыслей — без «просто не думай».")
_MYSL = _rec("Игра «Мысль под допросом»", "/fredi/?m=mysl", "10–15 минут",
             "Разбор тревожной мысли по косточкам — на ваших же примерах.")
_SOS = _rec("«Мне плохо сейчас»", "/fredi/?m=sos", "Несколько минут",
            "Протокол стабилизации на острый момент — чтобы продержаться до приёма, а не вместо него.")
_CHUVSTVA = _rec("Игра «Чувства»", "/fredi/?m=chuvstva", "10–15 минут",
                 "Точные слова вместо «нормально» — и своим состояниям, и чужим.")
_EQ = _rec("Курс «Эмоциональный интеллект»", "/blog/lektorij/emocionalnyj-intellekt/",
           "Бесплатно, без регистрации",
           "Учит читать чужое состояние до того, как о нём скажут словами.")
_PRIVYAZ = _rec("Курс «Привязанность и отношения»", "/blog/lektorij/privyazannost-i-otnosheniya/",
                "Бесплатно, без регистрации",
                "Откуда берётся фоновый страх потери и что с ним делают, кроме как требовать подтверждений.")
_SAMOOCENKA = _rec("Курс «Самооценка»", "/blog/lektorij/samoocenka/",
                   "Бесплатно, без регистрации",
                   "Про зависимость от чужой оценки, на которой и держится подозрение.")
_ROL = _rec("Тренажёр «Смени роль»", "/fredi/?m=rol", "10–15 минут",
            "Посмотреть на ту же сцену с места другого.")
_OPORA = _rec("Тренажёр «Опора»", "/fredi/?m=opora", "10–15 минут",
              "Ответ внутреннему критику — тому голосу, который говорит, что вас легко заменить.")

# Полоса результата: name — как она названа на экране, note — две-три
# строки своими словами (полный разбор человек уже прочитал, письмо его
# не пересказывает), recs — что делать.
TESTS: Dict[str, Dict[str, Any]] = {
    "phq9": {
        "title": "Тест на депрессию (PHQ-9)",
        "page": "/testy/depressiya-phq-9/",
        "max": 27,
        "bands": {
            "min": {"name": "Минимальные симптомы",
                    "note": "Выраженность депрессивных симптомов за две недели — в пределах обычного.",
                    "recs": [_rec("Курс «Депрессия и апатия»", "/blog/lektorij/depressiya-i-apatiya/",
                                  "Бесплатно, без регистрации",
                                  "Что отличает тоску от болезни и почему «взять себя в руки» не работает.")]},
            "light": {"name": "Лёгкие симптомы",
                      "note": "Симптомы есть, но лёгкие. На этом уровне обычно работает режим сна, "
                              "движение, живые люди и посильные дела. Пройдите тест снова через две "
                              "недели: если балл растёт — к специалисту.",
                      "recs": [_rec("Курс «Депрессия и апатия»", "/blog/lektorij/depressiya-i-apatiya/",
                                    "Бесплатно, без регистрации",
                                    "Что отличает тоску от болезни и почему «взять себя в руки» не работает."),
                               _rec("Курс «Сон»", "/blog/lektorij/son/", "Бесплатно",
                                    "Сон держит настроение сильнее, чем кажется, и просаживается первым."),
                               _rec("Симулятор дня «Спираль»", "/fredi/?m=spiral", "10–15 минут",
                                    "День, который не собирается: видно, где именно он рассыпается.")]},
            "moderate": {"name": "Умеренные симптомы", "clinical": True,
                         "note": "С балла 10 авторы шкалы рекомендуют очную оценку специалиста. "
                                 "Это не диагноз, но уровень, на котором состояние обычно уже "
                                 "отбирает работу, сон и отношения.",
                         "recs": [_SOS]},
            "severe": {"name": "Выраженные симптомы", "clinical": True,
                       "note": "Серьёзный уровень. Очная консультация психиатра — в ближайшее время. "
                               "Депрессия лечится, и на этом уровне лечение обычно заметно возвращает силы.",
                       "recs": [_SOS]},
            "extreme": {"name": "Тяжёлые симптомы", "clinical": True,
                        "note": "Очень высокий балл. Пожалуйста, обратитесь к психиатру как можно "
                                "быстрее — очно, не откладывая. С этим не надо справляться в одиночку.",
                        "recs": [_SOS]},
        },
    },
    "gad7": {
        "title": "Тест на тревожность (GAD-7)",
        "page": "/testy/trevoga-gad-7/",
        "max": 21,
        "bands": {
            "min": {"name": "Минимальная тревога",
                    "note": "Уровень тревожных симптомов за две недели — в пределах обычного.",
                    "recs": [_TREVOGA]},
            "light": {"name": "Лёгкая тревога",
                      "note": "Симптомы есть, но выраженность небольшая. На таком уровне обычно "
                              "хорошо работают навыки самопомощи, сон и меньше стимуляторов.",
                      "recs": [_TREVOGA, _KPT, _MYSL]},
            "moderate": {"name": "Умеренная тревога", "clinical": True,
                         "note": "С балла 10 авторы шкалы рекомендуют очную оценку специалиста — "
                                 "это порог, при котором тревога обычно уже мешает жить. "
                                 "Возьмите результат с собой на приём.",
                         "recs": [_SOS]},
            "severe": {"name": "Выраженная тревога", "clinical": True,
                       "note": "Высокий уровень. Стоит обратиться к психиатру или психотерапевту "
                               "очно и не откладывая: тревожные расстройства хорошо лечатся.",
                       "recs": [_SOS]},
        },
    },
    "revnost": {
        "title": "Тест на ревность",
        "page": "/testy/test-na-revnost/",
        "max": None,
        "bands": {
            "n": {"name": "Нормальная ревность",
                  "note": "Ревность у вас рабочая — её не «лечат», ей учатся пользоваться как сигналом.",
                  "recs": [_EQ, _CHUVSTVA]},
            "t": {"name": "Тревожная ревность",
                  "note": "Корень тревожной ревности обычно не в партнёре, а в типе привязанности — "
                          "с этого и стоит начинать.",
                  "recs": [_PRIVYAZ, _TREVOGA, _MYSL]},
            "r": {"name": "Ретроспективная ревность",
                  "note": "С прошлым партнёра работает контринтуитивное правило: «узнать всё» "
                          "не лечит, а подкармливает.",
                  "recs": [_KPT, _MYSL]},
            "p": {"name": "Проективная ревность",
                  "note": "Проективная ревность — про собственные импульсы, которые проще "
                          "заметить в другом.",
                  "recs": [_SAMOOCENKA, _OPORA]},
            "e": {"name": "Ревность самолюбия",
                  "note": "Здесь задето не чувство к человеку, а представление о себе, — "
                          "и работать стоит с ним.",
                  "recs": [_SAMOOCENKA,
                           _rec("Курс «Статус и доминирование»", "/blog/lektorij/status-i-dominirovanie/",
                                "Бесплатно",
                                "Почему сравнение ранит сильнее факта."),
                           _ROL]},
            "x": {"name": "Признаки патологической ревности", "clinical": True,
                  "note": "Сначала очный психиатр или психотерапевт — это не «черта характера». "
                          "Материалы ниже не заменяют визит, но помогут продержаться "
                          "и подготовиться к разговору.",
                  "recs": [_TREVOGA, _SOS]},
        },
    },
    "lyubit": {
        "title": "Тест на умение любить",
        "page": "/testy/test-na-umenie-lyubit/",
        "max": None,
        "bands": {
            "zabota": {"name": "Зона роста — забота",
                       "note": "Забота — это знать, чем человек живёт сейчас, и вкладываться "
                               "в это делом.",
                       "recs": [_EQ, _CHUVSTVA]},
            "otvetstvennost": {"name": "Зона роста — ответственность",
                               "note": "Ответственность — считать климат отношений своей работой, "
                                       "а не погодой.",
                               "recs": [_rec("Курс «Конфликты»", "/blog/lektorij/konflikty/",
                                             "Бесплатно, без регистрации",
                                             "Про один и тот же круг ссор и как из него выйти."),
                                        _rec("Тренажёр «Клин клином»", "/fredi/?m=klin", "10–15 минут",
                                             "Вернуть себя и собеседника из аффекта в разговор.")]},
            "uvazhenie": {"name": "Зона роста — уважение",
                          "note": "Уважение — видеть человека таким, какой он есть, а не таким, "
                                  "каким удобнее.",
                          "recs": [_rec("Курс «Личные границы»", "/blog/lektorij/lichnye-granicy/",
                                        "Бесплатно, без регистрации",
                                        "Где заканчивается забота и начинается распоряжение чужой жизнью."),
                                   _ROL]},
            "znanie": {"name": "Зона роста — знание",
                       "note": "Знание — интерес к внутренней жизни другого, а не к отчёту о его дне.",
                       "recs": [_PRIVYAZ,
                                _rec("Книга «Вариатика»",
                                     "/knigi/variatika-biblioteka-chelovecheskih-patternov/", "Книга",
                                     "Почему люди делают то, что делают, — если хочется понимать, "
                                     "а не догадываться.")]},
        },
    },
}


def band_for(test: str, band: str) -> Optional[Dict[str, Any]]:
    t = TESTS.get(test)
    if not t:
        return None
    return t["bands"].get(band)


def valid(test: str, band: str, score: Optional[int]) -> bool:
    """Ключ теста, полоса и балл — из нашего каталога, а не чьи угодно."""
    t = TESTS.get(test)
    if not t or band not in t["bands"]:
        return False
    if score is None:
        return True
    top = t.get("max")
    if top is None:
        return 0 <= int(score) <= 1000
    return 0 <= int(score) <= int(top)


def _abs(url: str) -> str:
    return url if url.startswith("http") else SITE + url


def _recs_text(recs: List[Dict[str, str]]) -> str:
    out = []
    for r in recs:
        out.append(f"• {r['title']} — {r['why']}\n  {_abs(r['url'])}")
    return "\n".join(out)


def _recs_html(recs: List[Dict[str, str]]) -> str:
    out = []
    for r in recs:
        out.append(
            '<div style="margin:0 0 14px;padding-left:12px;border-left:3px solid #3b82ff">'
            f'<a href="{_abs(r["url"])}" style="font-weight:700;color:#1d4ed8;'
            f'text-decoration:none">{escape(r["title"])}</a>'
            f'<div style="font-size:13px;color:#6b7280">{escape(r["fmt"])}</div>'
            f'<div style="font-size:14px">{escape(r["why"])}</div></div>'
        )
    return "".join(out)


def build_letter(test: str, band: str, score: Optional[int],
                 optout_link: str = "") -> Tuple[str, str, str]:
    """Тема, текстовая и HTML-версия письма с результатом.

    Разбор человек уже прочитал на экране — письмо не пересказывает его,
    а делает то, чего экран не умеет: остаётся. Поэтому в нём результат
    одной строкой, что с этим делать, дверь обратно к Фреди и адрес
    страницы теста, чтобы перечитать полностью.
    """
    t = TESTS[test]
    b = t["bands"][band]
    page = _abs(t["page"])
    score_line = (f"{b['name']} — {score} баллов из {t['max']}"
                  if score is not None and t.get("max") else b["name"])
    ask = f"Прошёл тест «{t['title']}». Результат: {score_line}. Что мне с этим делать?"
    from urllib.parse import quote
    fredi_link = FREDI_URL + "?ask=" + quote(ask)

    subject = f"Ваш результат: {t['title'].lower()}"

    # На клинической полосе продукт не идёт вперёд врача: человек в таком
    # состоянии берёт первое, что предложили, и откладывает визит.
    what = "Что делать сейчас" if b.get("clinical") else "Что с этим делать"

    text = (
        "Здравствуйте!\n\n"
        f"Ваш результат: {score_line}.\n\n"
        f"{b['note']}\n\n"
        f"{what}:\n{_recs_text(b['recs'])}\n\n"
        f"Полный разбор остался на странице теста: {page}\n\n"
        "Если хочется разобрать результат словами — Фреди уже знает, что у вас вышло, "
        "объяснять заново не придётся:\n"
        f"{fredi_link}\n\n"
        "— Фреди, виртуальный психолог\n"
    )

    html = (
        '<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,'
        'sans-serif;max-width:560px;margin:24px auto;padding:0 16px;color:#1c1c1e;'
        'line-height:1.55">'
        "<p>Здравствуйте!</p>"
        f'<p style="font-size:17px"><b>Ваш результат: {escape(score_line)}.</b></p>'
        f"<p>{escape(b['note'])}</p>"
        f'<p style="margin:22px 0 10px"><b>{what}</b></p>'
        + _recs_html(b["recs"]) +
        f'<p style="font-size:14px">Полный разбор остался на '
        f'<a href="{page}">странице теста</a>.</p>'
        '<p style="margin:24px 0 8px">Если хочется разобрать результат словами — '
        'Фреди уже знает, что у вас вышло:</p>'
        f'<p><a href="{fredi_link}" style="display:inline-block;background:#3b82ff;'
        'color:#fff;text-decoration:none;padding:13px 24px;border-radius:26px;'
        'font-weight:700;font-size:15px">Обсудить с Фреди</a></p>'
        '<p style="font-size:13px;color:#6b7280">Или наберите в браузере '
        '<a href="https://meysternlp.ru/fredi">meysternlp.ru/fredi</a> — без регистрации, '
        'можно голосом.</p>'
        "<p>— Фреди, виртуальный психолог</p>"
        + (f'<hr style="margin-top:36px;border:none;border-top:1px solid #e5e5ea">'
           f'<p style="font-size:12px;color:#8e8e93">Если письма от нас больше не нужны — '
           f'<a href="{optout_link}" style="color:#8e8e93">отписаться в один клик</a>.</p>'
           if optout_link else "")
        + "</body></html>"
    )
    return subject, text, html


def build_followup(test: str, band: str, optout_link: str = "") -> Tuple[str, str, str]:
    """Письмо третьего дня тем, кто прошёл короткий тест и не вернулся.

    Тест показывает состояние на сегодня, но ничего не меняет сам. Через
    три дня человек либо уже забыл результат, либо как раз упёрся в то,
    что тест назвал, — и это единственный момент, когда письмо попадает
    вовремя.
    """
    t = TESTS[test]
    b = t["bands"][band]
    from urllib.parse import quote
    ask = (f"Три дня назад прошёл тест «{t['title']}», вышло: {b['name']}. "
           "Хочу разобраться, что с этим делать.")
    fredi_link = FREDI_URL + "?ask=" + quote(ask)

    subject = "Тест показал, а дальше?"
    lead = (f"Три дня назад вы прошли «{t['title']}» — вышло «{b['name']}». "
            "Тест называет состояние, но сам по себе ничего не меняет: "
            "меняет то, что делают после него.")
    text = (
        "Здравствуйте!\n\n" + lead + "\n\n"
        f"{b['note']}\n\n"
        f"С чего начать:\n{_recs_text(b['recs'])}\n\n"
        "Или просто расскажите Фреди, как сейчас, — он помнит ваш результат:\n"
        f"{fredi_link}\n\n"
        "— Фреди, виртуальный психолог\n"
    )
    html = (
        '<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,'
        'sans-serif;max-width:560px;margin:24px auto;padding:0 16px;color:#1c1c1e;'
        'line-height:1.55">'
        f"<p>Здравствуйте!</p><p>{escape(lead)}</p>"
        f"<p>{escape(b['note'])}</p>"
        '<p style="margin:22px 0 10px"><b>С чего начать</b></p>'
        + _recs_html(b["recs"]) +
        '<p style="margin:24px 0 8px">Или просто расскажите Фреди, как сейчас, — '
        'он помнит ваш результат:</p>'
        f'<p><a href="{fredi_link}" style="display:inline-block;background:#3b82ff;'
        'color:#fff;text-decoration:none;padding:13px 24px;border-radius:26px;'
        'font-weight:700;font-size:15px">Поговорить с Фреди</a></p>'
        "<p>— Фреди, виртуальный психолог</p>"
        + (f'<hr style="margin-top:36px;border:none;border-top:1px solid #e5e5ea">'
           f'<p style="font-size:12px;color:#8e8e93">Если письма от нас больше не нужны — '
           f'<a href="{optout_link}" style="color:#8e8e93">отписаться в один клик</a>.</p>'
           if optout_link else "")
        + "</body></html>"
    )
    return subject, text, html
