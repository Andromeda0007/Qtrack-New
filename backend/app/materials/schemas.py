from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime


class MaterialCreate(BaseModel):
    material_name: str
    material_code: str
    description: Optional[str] = None
    unit_of_measure: str = "kg"
    default_pack_size: Optional[Decimal] = None


class MaterialUpdate(BaseModel):
    material_name: Optional[str] = None
    description: Optional[str] = None
    unit_of_measure: Optional[str] = None
    default_pack_size: Optional[Decimal] = None
    is_active: Optional[bool] = None


class MaterialResponse(BaseModel):
    id: int
    material_name: str
    material_code: str
    description: Optional[str]
    unit_of_measure: str
    default_pack_size: Optional[Decimal]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
