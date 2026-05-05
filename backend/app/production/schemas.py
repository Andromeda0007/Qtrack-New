from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date


class FGBatchCreate(BaseModel):
    fgtn_no: Optional[str] = None
    product_name: str
    batch_number: str
    manufacture_date: date
    expiry_date: date
    pack_size: Optional[str] = None
    unit_of_measure: Optional[str] = "KG"
    net_weight: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None
    quantity: Decimal
    carton_count: Optional[int] = None
    remarks: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def qty_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v
