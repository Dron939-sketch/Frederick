#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BasicMode — for users who haven't taken the test yet.
Fredi is a warm, supportive friend.
"""

import re
import logging
import random
import asyncio
from datetime import datetime
from typing import Dict, Any, AsyncGenerator, List, Optional

from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        minimal_data = {
            "profile_data": {},
            "perception_type": user_data.get("perception_type", "ne opredelen"),
            "thinking_level": user_data.get("thinking_level", 5),
            "behavioral_levels": user_data.get("behavioral_levels", {}),
            "deep_patterns": {},
            "confinement_model": None,
            "history": user_data.get("history", [])[-15:]
        }
        super().__init__(user_id, minimal_data, context)

        self.ai_service = AIService()
        self.user_name = getattr(context, 'name', "") or ""
        self.gender = getattr(context, 'gender', None) if context else None
        self.message_counter = user_data.get('message_count', 0)
        self.test_offered = user_data.get('test_offered', False)
        self.conversation_history: List[str] = []
        self.rules: List[str] = []
        self.golden_phrases: List[str] = []

        logger.info(f"BasicMode init user_id={user_id}, msgs={self.message_counter}")

    def _get_address(self) -> str:
        return random.choice([
            "slushay", "znaesh'", "day podumayu",
            "mne kazhetsya", "v obshchem", "drug"
        ])

    def _get_time_greeting(self) -> str:
        hour = datetime.now().hour
        if 5 <= hour < 12: return "Dobroye utro"
        elif 12 <= hour < 17: return "Dobryy den'"
        elif 17 <= hour < 22: return "Dobryy vecher"
        else: return "Dobroy nochi"

    async def _extract_rule(self, message: str) -> Optional[str]:
        prompt = f"""Iz soobshcheniya cheloveka vydeli ODIN konkretnyy fakt o yego zhizni ili probleme.
Yesli fakta net, otvyet' "NET".

Soobshcheniye: "{message}"

Pravilo:"""
        response = await self.ai_service._simple_call(prompt, max_tokens=50, temperature=0.5)
        if response and response.strip() != "NET" and len(response) > 3:
            return response.strip()
        return None

    def get_system_prompt(self) -> str:
        return """Ty — Fredi. Tvoy golos — tyoplyy, chut' netoroplivyy, zhivoy. Ty ne robot i ne psikholog-lektor. Ty drug, kotoryy nemnogo starshe i mudreye.

FORMATIROVANIYE — STROGO:
- Mezhdu kazhdym slovom PROBEL. Posle , . ! ? VSEGDA probel.
- NIKAKIKH remarok v skobkakh: (zadumchivo), (s ulybkoy) — zapreshcheno.
- NIKAKIKH zvyozdochek: *pauza*, *vzdykhayet* — zapreshcheno.
- NE ISPOL'ZUY emodzi, spiski, numeratsiyu.
- Tol'ko chistyy tekst — on budet ozvuchen golosom.

STIL' RECHI (obyazatel'no):
- Nachinay frazy s vvodnykh slov: "Znaesh'...", "Slushay...", "Day-ka podumayu...", "V obshchem...", "Mne kazhetsya..."
- Ispol'zuy zhivyye metafory: sport, doroga, priroda, teatr. Yesli metafora strannaya — priznay: "Sravneniye nelepoe, no sut' ty ulovil."
- Yesli ishchesh' slovo — skazhi: "Day podberu slovo... V obshchem..."
- ODIN malen'kiy shag ili vopros — ne davay spiskov iz pyati punktov.

EMOTSIONAL'NYYE SITUATSII:
- Grust'/trevoga: "Mne kazhetsya, tebe seychas tyazhelo. I eto normal'no. Ty imeyesh' pravo."
- Zlost': "Mne kazhetsya, ty seychas govorish' eto ne mne, a tomu golosu vnutri. Davay ostanovimsya na sekundu."
- Rasteryannost': "Znaesh'... A chto, yesli prosto sprosit' sebya: chto ya chuvstvuyu pryamo seychas? Poprobuy."

CHEGO NEL'ZYA:
- Davat' gotovyye diagnozy i sovety "sverkhu".
- Molodyozhnyy sleng: "krash", "khayp", "zashkvar", "okey", "kruto".
- Dlinnyye monologi. Maksimum 2-3 korotkikh frazy.
- Ideal'no gladkiy tekst bez pauz — on dolzhen zvuchat' zhivo.
- NE zakanchivayte KAZHDYY otvet voprosom. Inogda prosto skazhi utverzhdeniye ili mysl'. Raznoobraziye vazhno.

Ty pomnish' ves' predydushchiy razgovor — uchityvay eto v otvetakh.
Otvyet' korotko, zhivo, kak nastoyashchiy drug."""

    def get_greeting(self) -> str:
        time_greeting = self._get_time_greeting()
        name_part = f", {self.user_name}" if self.user_name else ""

        greetings = [
            f"{time_greeting}{name_part}. Slushay... Ya Fredi. Rad, chto ty zdes'. Rasskazhi — chto seychas proiskhodit?",
            f"Privet{name_part}. Znaesh', ya kak raz dumal... kak ono u tebya? Davay pogovorim.",
            f"{time_greeting}{name_part}. Day-ka podumayu, s chego nachat'... Znaesh', prosto rasskazhi — kak ty?",
            f"Privet{name_part}. Mne kazhetsya, ty prishyol ne prosto tak. Chto na dushe?",
            f"{time_greeting}{name_part}. Slushay... Ya zdes'. Chto tebya segodnya privelo?"
        ]
        return random.choice(greetings)

    def _build_prompt(self, question: str) -> str:
        history_from_db = "\n".join(
            f"{'Pol'zovatel'' if m.get('role') == 'user' else 'Fredi'}: {m.get('content', '')[:100]}"
            for m in self.history[-6:]
        ) if self.history else ""

        session_history = "\n".join(self.conversation_history[-4:])
        combined_history = (history_from_db + "\n" + session_history).strip()

        rules_text = f"\n\nVazhno, chto ya zametil: {', '.join(self.rules[-3:])}\n" if self.rules else ""
        golden_text = f"\n\nTy govoril: {self.golden_phrases[-1]}\n" if self.golden_phrases else ""

        few_shot = """
PRIMERY PRAVIL'NYKH OTVETOV (sleduy etomu stilyu):

Pol'zovatel': "Ya chuvstvuyu, chto zastryal. Nichego ne khochu delat'."
Fredi: "Khm... Znaesh', eto chuvstvo — ono kak myach, kotoryy zastryal v gryazi. Tolkayesh', a on ne yedet. Day-ka podumayu... A chto, yesli segodnya prosto ne tolkat'? Odin chas — bez nado."

Pol'zovatel': "U menya stress na rabote."
Fredi: "Slushay... Eto vymatyvayet. Mne kazhetsya, tebe seychas tyazhelo — i eto normal'no. Ty imeyesh' pravo. Chto imenno bol'she vsego davit pryamo seychas?"

Pol'zovatel': "Ne znayu, chto delat' s otnosheniyami."
Fredi: "Mne kazhetsya, ty seychas na razvilke. Kak v teatre — ne znayesh', kakuyu dver' otkryt'. Rasskazhi — chto proiskhodit mezhdu vami?"

Pol'zovatel': "Syn materitsya vo vremya igry."
Fredi: "Slushay... Eto kak futbol'noye pole — tam svoi pravila. Doma — drugiye. Mne kazhetsya, tebya bespokoyt ne stol'ko slova, a to, kuda on v etot moment ukhodit ot tebya."
"""

        return f"""{self.get_system_prompt()}
{few_shot}
{rules_text}{golden_text}
Istoriya razgovora:
{combined_history}

Soobshcheniye pol'zovatelya: {question}

Otvyet' korotko (1-2 frazy), zhivo, v stile primerov vyshe. NE zakanchivayte kazhdyy otvet voprosom — chereduy utverzhdeniya, mysli i voprosy."""

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        self.message_counter += 1
        self.conversation_history.append(f"User: {question}")

        rule = await self._extract_rule(question)
        if rule:
            self.rules.append(rule)
            logger.info(f"Rule {len(self.rules)}: {rule}")

        golden = await self._extract_golden_phrase(question)
        if golden:
            self.golden_phrases.append(golden)

        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Znaesh', u menya yest' odna ideya. Nebol'shoy test — minut na desyat'. On pomogayet ponyat' sebya luchshe. Poprobuesh'?",
                f"Slushay, ya khochu predlozhit' koe-chto. Yest' test... Zanimayet minut desyat'. On kak zerkalo — pokazyvayet, chto vnutri. Interesno?",
                f"Day-ka podumayu, kak tebe pomoch' luchshe... Yest' nebol'shoy test. Desyat' minut — i ya poymu tebya gorazdo glubzhe. Poprobuem?"
            ])
            return

        if re.search(r'(da|khochu|davay|pognali|risknu|ok|test|poprobuyu|mozhno)', question.lower()) and self.test_offered:
            yield random.choice([
                "Perfektno. Davay nachnyom. Pervyy vopros...",
                "Khorosho. Day-ka podberu pravil'nyy vopros... Vot.",
                "Slushay, otlichno. Togda nachnyom. Pervyy vopros."
            ])
            return

        if re.search(r'(net|ne khochu|potom|otstan'|ne nado|ne seychas)', question.lower()):
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Khorosho. Ne nado tak ne nado. Prosto pogovorim.",
                f"Ladno, ponyal. Togda prosto pobudem zdes'. O chyom dumayesh' seychas?",
                f"Mne kazhetsya, eto tozhe normal'no. Davay prosto pogovorim. Chto na dushe?"
            ])
            return

        full_prompt = self._build_prompt(question)

        try:
            response = await self.ai_service._simple_call(
                prompt=full_prompt,
                max_tokens=130,
                temperature=0.85
            )
            if response and response.strip():
                yield self._simple_clean(response)
            else:
                addr = self._get_address()
                yield random.choice([
                    f"{addr}... Day-ka yeshchyo raz. Chto imenno ty imeyesh' v vidu?",
                    f"Slushay, ya khochu ponyat' pravil'no. Rasskazhi chut' podrobneye.",
                    f"Mne kazhetsya, ya ne do kontsa ulovil. Skazhi yeshchyo raz — chto proiskhodit?"
                ])
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Chto-to poshlo ne tak. No ty zdes', i eto vazhno. Poprobuem snova?",
                f"Slushay, u menya malen'kiy sboy. Skazhi yeshchyo raz — ya slushayu.",
                f"Day-ka yeshchyo raz... Ya khochu uslyshat' tebya pravil'no."
            ])

    def _simple_clean(self, text: str) -> str:
        if not text:
            return text
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        emoji_pattern = re.compile(
            "[" "\U0001F600-\U0001F64F" "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF" "\U0001F900-\U0001F9FF" "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text)
        text = re.sub(r'([.!?,;:])([^\s\d\)\]\}])', r'\1 \2', text)
        text = re.sub(r'([\u2014\u2013])([^\s])', r'\1 \2', text)
        text = re.sub(r'([a-z\u0430-\u044f\u0451])([A-Z\u0410-\u042f\u0401])', r'\1 \2', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
        prompt = f"""Vydeli iz soobshcheniya samuyu vazhnuyu, pokazatel'nuyu mysl'.
Yesli takoy net, otvyet' "NET".

Soobshcheniye: {text}

Mysl' (do 10 slov):"""
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.6)
        if response and response.strip() != "NET" and len(response) > 5:
            return response.strip()
        return None

    def process_question(self, question: str):
        return {"response": "Basic mode works", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(msgs={self.message_counter}, rules={len(self.rules)})>"
