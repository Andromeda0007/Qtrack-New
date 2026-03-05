from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional

from app.database import get_db
from app.auth.dependencies import require_permission
from app.models.audit_models import AuditLog
from app.models.user_models import User

router = APIRouter()


@router.get("/")
async def get_audit_logs(
    action_type: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(require_permission("VIEW_AUDIT_LOGS")),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(desc(AuditLog.created_at))

    if action_type:
        query = query.where(AuditLog.action_type == action_type)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if username:
        query = query.where(AuditLog.username.ilike(f"%{username}%"))

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": log.username,
            "action_type": log.action_type,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
        }
        for log in logs
    ]
