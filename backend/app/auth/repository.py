from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.user_models import User, PasswordResetToken
from app.config import settings


async def get_user_by_login_id(db: AsyncSession, login_id: str) -> User | None:
    """Lookup by email or username — whichever matches."""
    result = await db.execute(
        select(User).where(or_(User.email == login_id, User.username == login_id))
    )
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_login_success(db: AsyncSession, user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.utcnow()
    await db.commit()


async def increment_failed_attempts(db: AsyncSession, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= 5:
        user.locked_until = datetime.utcnow() + timedelta(minutes=10)
    await db.commit()


async def reset_failed_attempts(db: AsyncSession, user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()


async def create_reset_token(db: AsyncSession, user_id: int, token: str) -> PasswordResetToken:
    reset_token = PasswordResetToken(
        user_id=user_id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
    )
    db.add(reset_token)
    await db.commit()
    await db.refresh(reset_token)
    return reset_token


async def get_reset_token(db: AsyncSession, token: str) -> PasswordResetToken | None:
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == token,
            PasswordResetToken.is_used == False,
        )
    )
    return result.scalar_one_or_none()


async def mark_reset_token_used(db: AsyncSession, reset_token: PasswordResetToken) -> None:
    reset_token.is_used = True
    await db.commit()


async def update_user_password(db: AsyncSession, user: User, new_hash: str) -> None:
    user.password_hash = new_hash
    user.is_first_login = False
    await db.commit()
