from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc, or_, cast, String
from typing import Optional

from app.database import get_db
from app.auth.dependencies import require_permission
from app.models.audit_models import AuditLog
from app.models.user_models import User

router = APIRouter()


async def _get_entity_usernames(db: AsyncSession, user_ids: list[int]) -> dict[int, str]:
    """Return map of user_id -> username for given ids."""
    if not user_ids:
        return {}
    result = await db.execute(select(User.id, User.username).where(User.id.in_(user_ids)))
    rows = result.all()
    return {r.id: r.username for r in rows}

# Category -> action_types for filtered fetch (no client-side filter)
AUDIT_CATEGORIES = {
    "user": [
        "CREATE_USER", "UPDATE_USER", "UPDATE_USER_ROLE", "DEACTIVATE_USER", "REACTIVATE_USER",
    ],
    "card_creation": ["CREATE_PRODUCT"],
    "approvals": [
        "APPROVE_MATERIAL", "INITIATE_RETEST", "RETEST_APPROVED", "APPROVE_GRADE_TRANSFER",
        "RECEIVE_FG", "APPROVE_FG", "CREATE_FG_BATCH", "ADD_AR_NUMBER", "REQUEST_GRADE_TRANSFER",
        "DISPATCH_FG", "INSPECT_FG", "ISSUE_STOCK", "ADJUST_STOCK",
    ],
    "rejections": ["REJECT_MATERIAL", "REJECT_FG", "RETEST_REJECTED"],
}


def _search_conditions(term: str):
    """One term must appear in at least one of these fields (OR)."""
    pattern = f"%{term}%"
    return or_(
        AuditLog.performed_by.ilike(pattern),
        AuditLog.description.ilike(pattern),
        AuditLog.action_type.ilike(pattern),
        AuditLog.entity_type.ilike(pattern),
        cast(AuditLog.entity_id, String).ilike(pattern),
        AuditLog.from_status.ilike(pattern),
        AuditLog.to_status.ilike(pattern),
    )


@router.get("/")
async def get_audit_logs(
    category: Optional[str] = Query(None, description="all | user | card_creation | approvals | rejections"),
    search: Optional[str] = Query(None, description="Match in any field; button-triggered; each log shown once"),
    sort: str = Query("desc", description="asc = oldest first, desc = newest first"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(require_permission("VIEW_AUDIT_LOGS")),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog)

    if category and category in AUDIT_CATEGORIES:
        query = query.where(AuditLog.action_type.in_(AUDIT_CATEGORIES[category]))

    if search and search.strip():
        words = [w.strip() for w in search.strip().split() if w.strip()]
        if words:
            # All words must appear somewhere in the log (AND per word)
            for word in words:
                query = query.where(_search_conditions(word))

    order_fn = asc(AuditLog.created_at) if sort == "asc" else desc(AuditLog.created_at)
    query = query.order_by(order_fn).limit(limit).offset(offset)
    result = await db.execute(query)
    logs = result.scalars().all()

    user_ids = [log.entity_id for log in logs if log.entity_type == "user" and log.entity_id is not None]
    user_ids = list(dict.fromkeys(user_ids))
    entity_usernames = await _get_entity_usernames(db, user_ids)

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "performed_by": log.performed_by,
            "action_type": log.action_type,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "entity_username": entity_usernames.get(log.entity_id) if log.entity_type == "user" and log.entity_id else None,
            "description": log.description,
            "ip_address": log.ip_address,
            "from_status": getattr(log, "from_status", None),
            "to_status": getattr(log, "to_status", None),
            "created_at": log.created_at,
        }
        for log in logs
    ]
