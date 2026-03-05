from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class InspectFGRequest(BaseModel):
    fg_batch_id: int
    quantity_verified: Optional[Decimal] = None
    inspection_remarks: Optional[str] = None


class ApproveFGRequest(BaseModel):
    fg_batch_id: int
    remarks: Optional[str] = None


class RejectFGRequest(BaseModel):
    fg_batch_id: int
    remarks: str
