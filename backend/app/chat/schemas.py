from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatRoomCreate(BaseModel):
    name: str
    room_type: str = "GLOBAL"
    description: Optional[str] = None


class AddMemberRequest(BaseModel):
    user_id: int


class SendMessageRequest(BaseModel):
    message_text: Optional[str] = None
    media_url: Optional[str] = None


class MessageResponse(BaseModel):
    id: int
    room_id: int
    sender_id: int
    message_text: Optional[str]
    media_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
