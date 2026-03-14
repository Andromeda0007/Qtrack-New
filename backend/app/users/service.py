from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.user_models import User, Role
from app.utils.password import hash_password
from app.utils.email_sender import send_account_created_email
from app.audit.service import log_action


async def create_user(db: AsyncSession, data: dict, created_by: User) -> dict:
    # Check username not taken
    result = await db.execute(select(User).where(User.username == data["username"]))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    result = await db.execute(select(User).where(User.email == data["email"]))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = await db.get(Role, data["role_id"])
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    temp_password = "temp-password"

    user = User(
        name=data["name"],
        username=data["username"],
        email=data["email"],
        password_hash=hash_password(temp_password),
        role_id=data["role_id"],
        phone=data.get("phone"),
        is_active=True,
        is_first_login=True,
    )
    db.add(user)
    await db.flush()

    await log_action(
        db,
        action_type="CREATE_USER",
        user_id=created_by.id,
        performed_by=created_by.username,
        entity_type="user",
        entity_id=user.id,
        description=f"Created user '{user.username}' with role '{role.role_name}'",
    )
    await db.commit()
    await db.refresh(user)

    # Send welcome email (non-blocking failure)
    try:
        await send_account_created_email(user.email, user.name, user.username, temp_password)
    except Exception:
        pass

    return {"user": user, "temp_password": temp_password}


async def get_all_users(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).options(selectinload(User.role)).order_by(User.created_at.desc())
    )
    return result.scalars().all()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.role))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def update_user(db: AsyncSession, user_id: int, data: dict, updated_by: User) -> User:
    user = await get_user_by_id(db, user_id)
    for key, value in data.items():
        if value is not None:
            setattr(user, key, value)
    await log_action(
        db, "UPDATE_USER", updated_by.id, updated_by.username,
        "user", user_id, f"Updated user '{user.username}'"
    )
    await db.commit()
    await db.refresh(user)
    return user


async def update_user_role(db: AsyncSession, user_id: int, role_id: int, updated_by: User) -> User:
    user = await get_user_by_id(db, user_id)
    old_role_id = user.role_id

    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    user.role_id = role_id
    await log_action(
        db, "UPDATE_USER_ROLE", updated_by.id, updated_by.username,
        "user", user_id, f"Role changed for '{user.username}' from role_id={old_role_id} to role_id={role_id}"
    )
    await db.commit()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user_id: int, updated_by: User) -> User:
    user = await get_user_by_id(db, user_id)
    if user.id == updated_by.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = False
    await log_action(
        db, "DEACTIVATE_USER", updated_by.id, updated_by.username,
        "user", user_id, f"Deactivated user '{user.username}'"
    )
    await db.commit()
    return user


async def reactivate_user(db: AsyncSession, user_id: int, updated_by: User) -> User:
    user = await get_user_by_id(db, user_id)
    user.is_active = True
    await log_action(
        db, "REACTIVATE_USER", updated_by.id, updated_by.username,
        "user", user_id, f"Reactivated user '{user.username}'"
    )
    await db.commit()
    return user


async def get_all_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(select(Role).order_by(Role.id))
    return result.scalars().all()
