from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user_models import User
from app.chat import service
from app.chat.schemas import ChatRoomCreate, AddMemberRequest, SendMessageRequest, MessageResponse

router = APIRouter()


@router.post("/rooms")
async def create_room(
    payload: ChatRoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await service.create_room(db, payload.name, payload.room_type, payload.description, current_user)
    return {"message": "Room created", "room_id": room.id, "name": room.name, "room_type": room.room_type}


@router.get("/rooms")
async def list_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rooms = await service.get_user_rooms(db, current_user.id)
    return [{"id": r.id, "name": r.name, "room_type": r.room_type, "description": r.description} for r in rooms]


@router.post("/rooms/{room_id}/members")
async def add_member(
    room_id: int,
    payload: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.add_member(db, room_id, payload.user_id, current_user)
    return {"message": "Member added"}


@router.post("/rooms/{room_id}/messages", response_model=MessageResponse)
async def send_message(
    room_id: int,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await service.send_message(db, room_id, payload.message_text, payload.media_url, current_user)
    return message


@router.get("/rooms/{room_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    room_id: int,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_messages(db, room_id, limit, offset, current_user)


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_message(db, message_id, current_user)
    return {"message": "Message deleted"}
