import re
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.chat_models import ChatRoom, ChatRoomMember, Message, ChatRoomType
from app.models.user_models import User


URL_PATTERN = re.compile(r'https?://\S+', re.IGNORECASE)


def _contains_link(text: str) -> bool:
    return bool(URL_PATTERN.search(text))


async def create_room(db: AsyncSession, name: str, room_type: str, description: str | None, created_by: User) -> ChatRoom:
    room = ChatRoom(
        name=name,
        room_type=room_type,
        description=description,
        created_by=created_by.id,
    )
    db.add(room)
    await db.flush()

    # Auto-add creator as member
    member = ChatRoomMember(room_id=room.id, user_id=created_by.id)
    db.add(member)

    await db.commit()
    await db.refresh(room)
    return room


async def add_member(db: AsyncSession, room_id: int, user_id: int, added_by: User) -> ChatRoomMember:
    # Check room exists
    room = await db.get(ChatRoom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")

    # Check not already a member
    existing = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == user_id,
            ChatRoomMember.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this room")

    member = ChatRoomMember(room_id=room_id, user_id=user_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def send_message(db: AsyncSession, room_id: int, text: str | None, media_url: str | None, sender: User) -> Message:
    # Validate sender is a member
    member_check = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == sender.id,
            ChatRoomMember.is_active == True,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this chat room")

    # Block external links
    if text and _contains_link(text):
        raise HTTPException(status_code=400, detail="External links are not allowed in messages")

    if not text and not media_url:
        raise HTTPException(status_code=400, detail="Message must have text or media")

    message = Message(
        room_id=room_id,
        sender_id=sender.id,
        message_text=text,
        media_url=media_url,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def get_messages(db: AsyncSession, room_id: int, limit: int = 50, offset: int = 0, user: User = None) -> list[Message]:
    # Validate user is a member
    if user:
        member_check = await db.execute(
            select(ChatRoomMember).where(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == user.id,
                ChatRoomMember.is_active == True,
            )
        )
        if not member_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You are not a member of this room")

    result = await db.execute(
        select(Message)
        .where(Message.room_id == room_id, Message.is_deleted == False)
        .order_by(Message.created_at.desc())
        .limit(limit).offset(offset)
    )
    return result.scalars().all()


async def get_user_rooms(db: AsyncSession, user_id: int) -> list[ChatRoom]:
    result = await db.execute(
        select(ChatRoom)
        .join(ChatRoomMember, ChatRoomMember.room_id == ChatRoom.id)
        .where(ChatRoomMember.user_id == user_id, ChatRoomMember.is_active == True, ChatRoom.is_active == True)
        .order_by(ChatRoom.created_at.desc())
    )
    return result.scalars().all()


async def delete_message(db: AsyncSession, message_id: int, user: User) -> bool:
    """Soft delete — only admin or sender can delete."""
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    is_admin = user.role and user.role.role_name == "WAREHOUSE_HEAD"
    if msg.sender_id != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Cannot delete this message")

    msg.is_deleted = True
    await db.commit()
    return True
