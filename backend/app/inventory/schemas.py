from pydantic import BaseModel, field_validator, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, date


class GRNCreate(BaseModel):
    """Warehouse Phase 1.A payload for creating a GRN.

    - ``material_id`` replaces the legacy free-text item_code/item_name pair
    - ``grn_number`` is server-generated and no longer sent by the client
    - ``rack_number`` is dropped (rack is assigned post-approval)
    - ``pack_size_description`` is deprecated
    - ``unit_of_measure`` (KG | COUNT), ``container_count`` and
      ``container_quantity`` are the new quantity model
    """
    material_id: int
    batch_number: str
    supplier_name: str
    manufacturer_name: str
    date_of_receipt: date
    manufacture_date: date
    expiry_date: date
    pack_type: str = "BAG"
    unit_of_measure: str = Field(default="KG", pattern="^(KG|COUNT|L)$")
    container_count: int
    container_quantity: Decimal
    total_quantity: Decimal

    @field_validator("total_quantity", "container_quantity")
    @classmethod
    def qty_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v

    @field_validator("container_count")
    @classmethod
    def containers_positive(cls, v):
        if v < 1:
            raise ValueError("Container count must be at least 1")
        return v

    @field_validator("pack_type")
    @classmethod
    def normalize_pack_type(cls, v):
        return v.upper()

    @field_validator("unit_of_measure")
    @classmethod
    def normalize_uom(cls, v):
        normalized = v.upper()
        if normalized == "LITRES" or normalized == "LITER" or normalized == "LITRE":
            return "L"
        return normalized


# Legacy alias — old routers referenced ``ProductCreate``. Keep a subclass so
# any stray imports still work during the transition.
class ProductCreate(GRNCreate):
    pass


class ContainerResponse(BaseModel):
    container_number: int
    unique_code: str
    qr_base64: Optional[str] = None

    model_config = {"from_attributes": True}


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
    labels_printed: bool = False
    ar_number: Optional[str] = None
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
