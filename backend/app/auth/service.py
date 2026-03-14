from datetime import datetime, timedelta

from fastapi import HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user_models import User
from app.utils.password import verify_password, hash_password, generate_reset_token
from app.utils.email_sender import send_password_reset_email
from app.auth import repository as repo


def create_access_token(user: User) -> str:
    payload = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role.role_name if user.role else "",
        "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def login(db: AsyncSession, login_id: str, password: str) -> dict:
    user = await repo.get_user_by_login_id(db, login_id)  # checks email OR username

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is locked. Try again in {remaining} minutes.",
        )

    if not verify_password(password, user.password_hash):
        await repo.increment_failed_attempts(db, user)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    await repo.update_login_success(db, user)

    # Eager-load role for token
    await db.refresh(user, ["role"])
    token = create_access_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "role": user.role.role_name if user.role else "",
        "is_first_login": user.is_first_login,
    }


async def forgot_password(db: AsyncSession, email: str) -> str:
    user = await repo.get_user_by_email(db, email)
    if not user:
        # Return generic message even if user not found (security)
        return "If that email exists, a reset link has been sent."

    token = generate_reset_token()
    await repo.create_reset_token(db, user.id, token)
    await send_password_reset_email(user.email, user.name, token)
    return "If that email exists, a reset link has been sent."


async def reset_password(db: AsyncSession, token: str, new_password: str) -> str:
    _validate_password_strength(new_password)

    reset_record = await repo.get_reset_token(db, token)
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if reset_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = await repo.get_user_by_id(db, reset_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="User not found or deactivated")

    await repo.update_user_password(db, user, hash_password(new_password))
    await repo.mark_reset_token_used(db, reset_record)
    return "Password reset successfully"


async def change_password(db: AsyncSession, user: User, old_password: str, new_password: str) -> str:
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    _validate_password_strength(new_password)
    await repo.update_user_password(db, user, hash_password(new_password))
    return "Password changed successfully"


def _validate_password_strength(password: str) -> None:
    if (
        len(password) < 8
        or not any(c.isupper() for c in password)
        or not any(c.islower() for c in password)
        or not any(c.isdigit() for c in password)
        or not any(c in "!@#$%^&*" for c in password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters with uppercase, lowercase, digit, and special character (!@#$%^&*)",
        )
