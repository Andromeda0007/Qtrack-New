from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_models import AuditLog


def audit_status_value(status) -> str | None:
    """Serialize enum or status-like values for audit from_status / to_status columns."""
    if status is None:
        return None
    return status.value if hasattr(status, "value") else str(status)


async def log_action(
    db: AsyncSession,
    action_type: str,
    user_id: int | None = None,
    performed_by: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    description: str | None = None,
    ip_address: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> None:
    """
    Central audit logging. Call after every important state change.
    Audit logs are append-only — never update or delete.
    """
    log = AuditLog(
        user_id=user_id,
        performed_by=performed_by,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        ip_address=ip_address,
        from_status=from_status,
        to_status=to_status,
    )
    db.add(log)
    await db.flush()
