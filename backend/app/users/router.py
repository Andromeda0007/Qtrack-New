from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user_models import User
from app.users import service
from app.users.schemas import UserCreate, UserUpdate, UserRoleUpdate, UserResponse, RoleResponse

router = APIRouter()


@router.post("/", response_model=dict)
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_permission("CREATE_USER")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.create_user(db, payload.model_dump(), current_user)
    user = result["user"]
    return {
        "message": "User created successfully",
        "user_id": user.id,
        "username": user.username,
        "temp_password_sent_via_email": True,
    }


@router.get("/", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    users = await service.get_all_users(db)
    return [
        UserResponse(
            **{k: getattr(u, k) for k in ["id", "name", "username", "email", "role_id", "phone", "is_active", "is_first_login", "last_login", "created_at"]},
            role_name=u.role.role_name if u.role else None,
        )
        for u in users
    ]


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_all_roles(db)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    user = await service.get_user_by_id(db, user_id)
    return UserResponse(
        **{k: getattr(user, k) for k in ["id", "name", "username", "email", "role_id", "phone", "is_active", "is_first_login", "last_login", "created_at"]},
        role_name=user.role.role_name if user.role else None,
    )


@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    user = await service.update_user(db, user_id, payload.model_dump(exclude_none=True), current_user)
    return {"message": "User updated", "user_id": user.id}


@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    user = await service.update_user_role(db, user_id, payload.role_id, current_user)
    return {"message": "Role updated", "user_id": user.id}


@router.patch("/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    await service.deactivate_user(db, user_id, current_user)
    return {"message": "User deactivated"}


@router.patch("/{user_id}/reactivate")
async def reactivate_user(
    user_id: int,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    await service.reactivate_user(db, user_id, current_user)
    return {"message": "User reactivated"}
