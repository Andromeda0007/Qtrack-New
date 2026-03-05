from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_models import AuditLog


async def log_action(
    db: AsyncSession,
    action_type: str,
    user_id: int | None = None,
    username: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    description: str | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Central audit logging function.
    Call this after every important state change in the system.
    Audit logs are append-only — never update or delete.
    """
    log = AuditLog(
        user_id=user_id,
        username=username,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        ip_address=ip_address,
    )
    db.add(log)
    # Flush without commit so audit log is part of the same transaction
    await db.flush()
