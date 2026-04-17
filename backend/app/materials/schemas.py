from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime


class MaterialCreate(BaseModel):
    """Warehouse Head creates an Item. Code is auto-generated (ITM-NNN)."""
    material_name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    # Default unit hint for this item (KG or COUNT). User can override per-GRN.
    unit_of_measure: str = Field(default="KG", pattern="^(KG|COUNT)$")


class MaterialUpdate(BaseModel):
    material_name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    unit_of_measure: Optional[str] = Field(None, pattern="^(KG|COUNT)$")
    is_active: Optional[bool] = None


class MaterialResponse(BaseModel):
    id: int
    material_name: str
    material_code: str
    description: Optional[str]
    unit_of_measure: str
    is_active: bool
    created_by: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class MaterialBatchCounts(BaseModel):
    """How many active (non-final) batches reference this material, by status."""
    quarantine: int
    under_test: int
    approved: int
    quarantine_retest: int
    issued_to_production: int
    total_active: int
