from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.chat_models import ChatRoom, ChatMember, ChatMessage
from app.models.user_models import User


async def get_or_create_dm(db: AsyncSession, user_a: int, user_b: int) -> ChatRoom:
    """Find existing 1-on-1 room between two users or create one."""
    # Find a non-group room where both users are members
    subq_a = select(ChatMember.room_id).where(ChatMember.user_id == user_a)
    subq_b = select(ChatMember.room_id).where(ChatMember.user_id == user_b)

    result = await db.execute(
        select(ChatRoom)
        .where(
            ChatRoom.is_group == False,
            ChatRoom.is_active == True,
            ChatRoom.id.in_(subq_a),
            ChatRoom.id.in_(subq_b),
        )
        .limit(1)
    )
    room = result.scalar_one_or_none()
    if room:
        return room

    # Create new DM room
    room = ChatRoom(is_group=False, name=None, created_by=user_a)
    db.add(room)
    await db.flush()
    db.add(ChatMember(room_id=room.id, user_id=user_a))
    db.add(ChatMember(room_id=room.id, user_id=user_b))
    await db.commit()
    await db.refresh(room)
    return room


async def create_group(db: AsyncSession, name: str, member_ids: list[int], created_by: int, description: str | None = None) -> ChatRoom:
    room = ChatRoom(is_group=True, name=name, description=(description or "").strip() or None, created_by=created_by)
    db.add(room)
    await db.flush()
    all_ids = list({created_by} | set(member_ids))
    for uid in all_ids:
        db.add(ChatMember(room_id=room.id, user_id=uid))
    await db.commit()
    await db.refresh(room)
    return room


async def get_user_rooms(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(
        select(ChatRoom)
        .join(ChatMember, ChatMember.room_id == ChatRoom.id)
        .where(ChatMember.user_id == user_id, ChatRoom.is_active == True)
        .options(selectinload(ChatRoom.members).selectinload(ChatMember.user))
        .order_by(ChatRoom.created_at.desc())
    )
    rooms = result.scalars().all()

    output = []
    for room in rooms:
        # Last message
        last_msg_res = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.room_id == room.id, ChatMessage.is_deleted == False)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_res.scalar_one_or_none()

        # Unread count
        unread_res = await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.room_id == room.id,
                ChatMessage.sender_id != user_id,
                ChatMessage.is_deleted == False,
            )
        )
        # (simplified unread — full read-receipts can be added later)
        unread = 0

        members = [
            {"id": m.user.id, "name": m.user.name or m.user.username, "username": m.user.username}
            for m in room.members
        ]
        other = next((m for m in members if m["id"] != user_id), None)

        output.append({
            "id": room.id,
            "is_group": room.is_group,
            "name": room.name if room.is_group else (other["name"] if other else "Unknown"),
            "last_message": last_msg.content if last_msg else None,
            "last_message_at": last_msg.created_at.isoformat() if last_msg else None,
            "unread_count": unread,
            "other_user": other if not room.is_group else None,
            "members": members,
        })

    return output


async def get_messages(db: AsyncSession, room_id: int, user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    # Verify membership
    member = await db.execute(
        select(ChatMember).where(ChatMember.room_id == room_id, ChatMember.user_id == user_id)
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id, ChatMessage.is_deleted == False)
        .options(selectinload(ChatMessage.sender))
        .order_by(ChatMessage.created_at.asc())
        .limit(limit).offset(offset)
    )
    msgs = result.scalars().all()
    return [
        {
            "id": m.id,
            "room_id": m.room_id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.name or m.sender.username,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
            "is_deleted": m.is_deleted,
        }
        for m in msgs
    ]


async def save_message(db: AsyncSession, room_id: int, sender_id: int, content: str) -> dict:
    msg = ChatMessage(room_id=room_id, sender_id=sender_id, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Load sender for name
    sender = await db.get(User, sender_id)
    return {
        "id": msg.id,
        "room_id": msg.room_id,
        "sender_id": msg.sender_id,
        "sender_name": (sender.name or sender.username) if sender else str(sender_id),
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
        "is_deleted": False,
    }


async def edit_message(db: AsyncSession, message_id: int, content: str, sender_id: int) -> dict:
    msg = await db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != sender_id:
        raise HTTPException(status_code=403, detail="Cannot edit this message")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")
    msg.content = content.strip()
    await db.commit()
    return {"message_id": message_id, "content": msg.content, "room_id": msg.room_id}


async def delete_message_for_all(db: AsyncSession, message_id: int, sender_id: int) -> dict:
    msg = await db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != sender_id:
        raise HTTPException(status_code=403, detail="Cannot delete this message")
    msg.is_deleted = True
    await db.commit()
    return {"message_id": message_id, "room_id": msg.room_id}


async def get_room_member_ids(db: AsyncSession, room_id: int) -> list[int]:
    result = await db.execute(select(ChatMember.user_id).where(ChatMember.room_id == room_id))
    return [row[0] for row in result.fetchall()]


async def get_room_info(db: AsyncSession, room_id: int, user_id: int) -> dict:
    """Return group room info (name, description, members) if current user is a member."""
    member_check = await db.execute(
        select(ChatMember).where(ChatMember.room_id == room_id, ChatMember.user_id == user_id)
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")
    result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id, ChatRoom.is_group == True)
        .options(selectinload(ChatRoom.members).selectinload(ChatMember.user))
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found or not a group")
    members = [
        {"id": m.user.id, "name": m.user.name or m.user.username, "username": m.user.username}
        for m in room.members
    ]
    return {
        "name": room.name or "",
        "description": (room.description or "").strip(),
        "members": members,
    }


async def search_users(db: AsyncSession, query: str, exclude_id: int) -> list[dict]:
    stmt = (
        select(User)
        .where(User.id != exclude_id, User.is_active == True)
        .options(selectinload(User.role))
    )
    if query.strip():
        stmt = stmt.where(User.name.ilike(f"%{query}%") | User.username.ilike(f"%{query}%"))
    stmt = stmt.order_by(User.name).limit(200)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "name": u.name or u.username,
            "username": u.username,
            "role": u.role.role_name if u.role else None,
        }
        for u in users
    ]
