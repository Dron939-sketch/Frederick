# hypno/anchoring.py
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class Anchoring:
    """Класс для работы с якорями (ресурсными состояниями)"""
    
    def __init__(self):
        self.anchors: Dict[int, Dict[str, Dict]] = {}
        logger.info("Anchoring initialized")
    
    def create_anchor(self, user_id: int, trigger: str, state: str, phrase: str = None) -> Dict:
        """Создать якорь"""
        if user_id not in self.anchors:
            self.anchors[user_id] = {}
        
        self.anchors[user_id][trigger] = {
            "state": state,
            "phrase": phrase or self._get_default_phrase(state),
            "created_at": None
        }
        
        logger.info(f"Anchor created for user {user_id}: {trigger} -> {state}")
        
        return {
            "success": True,
            "anchor": {
                "user_id": user_id,
                "trigger": trigger,
                "state": state,
                "phrase": self.anchors[user_id][trigger]["phrase"]
            }
        }
    
    def fire_anchor(self, user_id: int, trigger: str) -> Optional[str]:
        """Активировать якорь"""
        if user_id in self.anchors and trigger in self.anchors[user_id]:
            phrase = self.anchors[user_id][trigger]["phrase"]
            logger.info(f"Anchor fired for user {user_id}: {trigger}")
            return phrase
        
        logger.warning(f"Anchor not found: user={user_id}, trigger={trigger}")
        return None
    
    def set_anchor(self, user_id: int, name: str, state: str, phrase: str):
        """Установить якорь (алиас для create_anchor)"""
        return self.create_anchor(user_id, name, state, phrase)
    
    def _get_default_phrase(self, state: str) -> str:
        """Получить фразу по умолчанию для состояния"""
        phrases = {
            "calm": "Я спокоен. Я дышу ровно. Всё хорошо.",
            "confidence": "Я знаю, что делаю. У меня всё получится.",
            "action": "Пора действовать. Я готов.",
            "trust": "Я доверяю себе и миру.",
            "insight": "Понимание приходит. Я вижу яснее."
        }
        return phrases.get(state, "Я здесь и сейчас. Я в безопасности.")
