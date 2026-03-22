from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date


class AddARNumberRequest(BaseModel):
    batch_id: int
    ar_number: str
    sample_quantity: Optional[Decimal] = None


class WithdrawSampleRequest(BaseModel):
    batch_id: int
    sample_quantity: Decimal
    remarks: Optional[str] = None

    @field_validator("sample_quantity")
    @classmethod
    def qty_positive(cls, v):
        if v <= 0:
            raise ValueError("Sample quantity must be positive")
        return v


class ApproveRejectRequest(BaseModel):
    batch_id: int
    retest_date: Optional[date] = None
    remarks: Optional[str] = None

    @field_validator("retest_date")
    @classmethod
    def retest_date_required_for_approval(cls, v):
        return v


class RejectRequest(BaseModel):
    batch_id: int
    remarks: str


class InitiateRetestRequest(BaseModel):
    batch_id: int
    remarks: Optional[str] = None


class GradeTransferRequest(BaseModel):
    batch_id: int
    new_material_id: int
    reason: str


class ApproveGradeTransferRequest(BaseModel):
    transfer_id: int
    remarks: Optional[str] = None


class RetestApproveRejectRequest(BaseModel):
    batch_id: int
    approved: bool
    retest_date: Optional[date] = None
    remarks: Optional[str] = None
