from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification_models import Notification, NotificationType
from app.models.user_models import User, Role, RolePermission, Permission


async def create_notification(
    db: AsyncSession,
    user_id: int,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.SYSTEM_ALERT,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_role(
    db: AsyncSession,
    role_name: str,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.SYSTEM_ALERT,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> int:
    """Send notification to all active users with a given role."""
    result = await db.execute(
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(Role.role_name == role_name, User.is_active == True)
    )
    users = result.scalars().all()
    count = 0
    for user in users:
        await create_notification(db, user.id, title, message, notification_type, entity_type, entity_id)
        count += 1
    return count


async def notify_roles(
    db: AsyncSession,
    role_names: list[str],
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.SYSTEM_ALERT,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> int:
    count = 0
    for role_name in role_names:
        count += await notify_role(db, role_name, title, message, notification_type, entity_type, entity_id)
    return count


async def get_user_notifications(db: AsyncSession, user_id: int, unread_only: bool = False) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc()).limit(100)
    if unread_only:
        query = query.where(Notification.is_read == False)
    result = await db.execute(query)
    return result.scalars().all()


async def mark_notification_read(db: AsyncSession, notification_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification:
        notification.is_read = True
        await db.commit()
        return True
    return False


async def mark_all_read(db: AsyncSession, user_id: int) -> None:
    result = await db.execute(
        select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
