from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import datetime, date


class ProductCreate(BaseModel):
    item_code: str
    item_name: str
    grn_number: str
    batch_number: str
    total_quantity: Decimal
    container_quantity: Decimal
    pack_type: str = "BAG"
    supplier_name: str
    manufacturer_name: str
    date_of_receipt: date
    manufacture_date: date
    expiry_date: date
    # Optional e.g. "160 x 25.00 kg" for quarantine label / reports.
    pack_size_description: Optional[str] = None
    # Physical location in quarantine area (required — no default rack).
    rack_number: str

    @field_validator("rack_number")
    @classmethod
    def rack_required(cls, v: str) -> str:
        if not (v or "").strip():
            raise ValueError("Quarantine rack / storage location is required")
        return v.strip()

    @field_validator("total_quantity", "container_quantity")
    @classmethod
    def qty_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v

    @field_validator("pack_type")
    @classmethod
    def normalize_pack_type(cls, v):
        return v.upper()


class IssueStockRequest(BaseModel):
    batch_id: int
    quantity: Decimal
    remarks: Optional[str] = None
    issued_to_product_name: Optional[str] = None
    issued_to_batch_ref: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def qty_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v


class UpdateRackRequest(BaseModel):
    rack_number: str


class StockAdjustmentRequest(BaseModel):
    batch_id: int
    quantity: Decimal
    reason: str


class BatchResponse(BaseModel):
    id: int
    material_id: int
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    manufacturer_name: Optional[str] = None
    batch_number: str
    grn_number: Optional[str] = None
    manufacture_date: Optional[date] = None
    expiry_date: Optional[date] = None
    pack_size: Optional[Decimal] = None
    pack_type: str
    total_quantity: Decimal
    remaining_quantity: Decimal
    status: str
    retest_date: Optional[date] = None
    retest_cycle: int
    qr_code_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StockReportItem(BaseModel):
    batch_number: str
    material_name: str
    material_code: str
    supplier_name: Optional[str]
    total_quantity: Decimal
    remaining_quantity: Decimal
    status: str
    expiry_date: Optional[date]
    retest_date: Optional[date]
    ar_number: Optional[str]
