import json
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.service import decode_token
from app.models.user_models import User
from app.models.chat_models import ChatMember
from app.chat import service
from app.chat.ws_manager import manager
from sqlalchemy import select

router = APIRouter()


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...), db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(token)
        user_id = int(payload.get("user_id"))
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            room_id = data.get("room_id")
            content = (data.get("content") or "").strip()
            if not room_id or not content:
                continue

            # Verify sender is a member
            member_check = await db.execute(
                select(ChatMember).where(ChatMember.room_id == room_id, ChatMember.user_id == user_id)
            )
            if not member_check.scalar_one_or_none():
                continue

            # Save message
            msg = await service.save_message(db, room_id, user_id, content)

            # Broadcast to all room members
            members_res = await db.execute(
                select(ChatMember.user_id).where(ChatMember.room_id == room_id)
            )
            member_ids = [row[0] for row in members_res.fetchall()]
            await manager.broadcast_to_users(member_ids, {"type": "message", **msg})

    except WebSocketDisconnect:
        manager.disconnect(user_id)


# ─── REST: Rooms ──────────────────────────────────────────────────────────────

@router.post("/dm")
async def start_dm(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    other_id = payload.get("user_id")
    if not other_id or other_id == current_user.id:
        raise HTTPException(status_code=400, detail="Invalid user")
    room = await service.get_or_create_dm(db, current_user.id, other_id)
    return {"room_id": room.id, "is_group": room.is_group}


@router.post("/group")
async def create_group(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = payload.get("name", "").strip()
    member_ids = payload.get("member_ids", [])
    if not name:
        raise HTTPException(status_code=400, detail="Group name required")
    room = await service.create_group(db, name, member_ids, current_user.id)
    return {"room_id": room.id, "is_group": True, "name": room.name}


@router.get("/rooms")
async def list_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_user_rooms(db, current_user.id)


@router.get("/rooms/{room_id}/messages")
async def get_messages(
    room_id: int,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_messages(db, room_id, current_user.id, limit, offset)


# ─── REST: Message actions ───────────────────────────────────────────────────

@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = (payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    result = await service.edit_message(db, message_id, content, current_user.id)
    member_ids = await service.get_room_member_ids(db, result["room_id"])
    await manager.broadcast_to_users(member_ids, {"type": "edit", **result})
    return result


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await service.delete_message_for_all(db, message_id, current_user.id)
    member_ids = await service.get_room_member_ids(db, result["room_id"])
    await manager.broadcast_to_users(member_ids, {"type": "delete", **result})
    return {"ok": True}


# ─── REST: User search (must be before /users/{user_id}/profile) ───────────────

@router.get("/users/search")
async def search_users(
    q: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.search_users(db, q, current_user.id)


@router.get("/users/{user_id}/profile")
async def get_contact_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.users import service as users_service
    user = await users_service.get_user_by_id(db, user_id)
    role_name = user.role.role_name if user.role else None
    return {
        "id": user.id,
        "name": user.name or "",
        "username": user.username or "",
        "email": user.email or "",
        "phone": str(user.phone) if user.phone is not None else "",
        "role_name": role_name or "",
    }
