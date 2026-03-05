from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date


class ReceiveFGRequest(BaseModel):
    fg_batch_id: int
    location_id: Optional[int] = None


class DispatchRequest(BaseModel):
    fg_batch_id: int
    customer_name: str
    quantity: Decimal
    dispatch_date: Optional[date] = None
    invoice_number: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v
