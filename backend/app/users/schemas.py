from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    role_id: int
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role_id: int


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: str
    role_id: int
    role_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_first_login: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleResponse(BaseModel):
    id: int
    role_name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}
