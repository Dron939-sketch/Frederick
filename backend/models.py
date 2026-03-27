from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class UserProfile(BaseModel):
    user_id: int
    profile_data: Optional[Dict] = None
    perception_type: Optional[str] = None
    thinking_level: Optional[int] = None
    behavioral_levels: Optional[Dict] = None
    created_at: Optional[datetime] = None

class UserContext(BaseModel):
    user_id: int
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    communication_mode: str = "psychologist"
    context_data: Dict = {}

class Message(BaseModel):
    id: int
    user_id: int
    role: str
    content: str
    created_at: datetime

class ChatRequest(BaseModel):
    user_id: int
    message: str
    mode: str = "psychologist"

class VoiceRequest(BaseModel):
    user_id: int

class VoiceResponse(BaseModel):
    success: bool
    recognized_text: Optional[str] = None
    answer: Optional[str] = None
    audio_base64: Optional[str] = None
    error: Optional[str] = None

class SaveContextRequest(BaseModel):
    user_id: int
    context: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, Any]

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
