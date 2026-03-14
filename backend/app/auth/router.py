from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import service
from app.auth.schemas import (
    UserLoginRequest, TokenResponse, ForgotPasswordRequest,
    ResetPasswordRequest, ChangePasswordRequest,
)
from app.auth.dependencies import get_current_user
from app.models.user_models import User

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    return await service.login(db, payload.username, payload.password)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    message = await service.forgot_password(db, payload.email)
    return {"message": message}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    message = await service.reset_password(db, payload.token, payload.new_password)
    return {"message": message}


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await service.change_password(db, current_user, payload.old_password, payload.new_password)
    return {"message": message}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "username": current_user.username,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role.role_name if current_user.role else None,
        "is_first_login": current_user.is_first_login,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login,
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    # JWT is stateless — client deletes token
    return {"message": "Logged out successfully"}
