from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal

from app.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user_models import User
from app.inventory import service
from app.inventory.schemas import GRNCreate, IssueStockRequest, StockAdjustmentRequest
from app.utils.pdf_generator import generate_quarantine_label

router = APIRouter()


@router.post("/grn")
async def create_grn(
    payload: GRNCreate,
    current_user: User = Depends(require_permission("CREATE_GRN")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.create_grn(db, payload.model_dump(), current_user)
    batch = result["batch"]
    material = result["material"]
    supplier = result["supplier"]
    return {
        "message": "Product card created successfully",
        "batch_id": batch.id,
        "item_code": material.material_code,
        "item_name": material.material_name,
        "batch_number": batch.batch_number,
        "grn_number": result["grn_number"],
        "total_quantity": str(batch.total_quantity),
        "container_quantity": str(batch.pack_size or ""),
        "pack_type": batch.pack_type,
        "supplier_name": supplier.supplier_name,
        "manufacturer_name": result["manufacturer_name"],
        "date_of_receipt": result["date_of_receipt"],
        "manufacture_date": str(batch.manufacture_date) if batch.manufacture_date else "",
        "expiry_date": str(batch.expiry_date) if batch.expiry_date else "",
        "status": batch.status,
        "created_at": str(batch.created_at),
        "qr_data": result["qr_data"],
        "qr_base64": result["qr_base64"],
    }


@router.get("/batches")
async def list_batches(
    status: Optional[str] = Query(None),
    material_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    batches = await service.get_all_batches(db, status, material_id)
    return [
        {
            "id": b.id,
            "batch_number": b.batch_number,
            "material_name": b.material.material_name if b.material else None,
            "material_code": b.material.material_code if b.material else None,
            "supplier_name": b.supplier.supplier_name if b.supplier else None,
            "grn_number": b.grn.grn_number if b.grn else None,
            "total_quantity": b.total_quantity,
            "remaining_quantity": b.remaining_quantity,
            "status": b.status,
            "expiry_date": b.expiry_date,
            "retest_date": b.retest_date,
            "retest_cycle": b.retest_cycle,
            "created_at": b.created_at,
        }
        for b in batches
    ]


@router.get("/batches/{batch_id}")
async def get_batch(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.get_batch_by_id(db, batch_id)
    return {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "material": {"id": batch.material.id, "name": batch.material.material_name, "code": batch.material.material_code} if batch.material else None,
        "supplier": {"id": batch.supplier.id, "name": batch.supplier.supplier_name} if batch.supplier else None,
        "grn_number": batch.grn.grn_number if batch.grn else None,
        "date_of_receipt": str(batch.grn.received_date) if batch.grn and batch.grn.received_date else None,
        "manufacturer_name": batch.manufacturer_name,
        "manufacture_date": batch.manufacture_date,
        "expiry_date": batch.expiry_date,
        "pack_size": batch.pack_size,
        "pack_type": batch.pack_type,
        "total_quantity": batch.total_quantity,
        "remaining_quantity": batch.remaining_quantity,
        "status": batch.status,
        "retest_date": batch.retest_date,
        "retest_cycle": batch.retest_cycle,
        "qr_code_path": batch.qr_code_path,
        "ar_number": batch.qc_results[-1].ar_number if batch.qc_results else None,
    }


@router.get("/scan/{qr_data}")
async def scan_qr(
    qr_data: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.get_batch_by_qr(db, qr_data)
    return {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "material_name": batch.material.material_name if batch.material else None,
        "status": batch.status,
        "remaining_quantity": batch.remaining_quantity,
        "retest_date": batch.retest_date,
        "ar_number": batch.qc_results[-1].ar_number if batch.qc_results else None,
    }


@router.post("/issue-stock")
async def issue_stock(
    payload: IssueStockRequest,
    current_user: User = Depends(require_permission("ISSUE_STOCK")),
    db: AsyncSession = Depends(get_db),
):
    return await service.issue_stock(db, payload.batch_id, payload.quantity, payload.remarks, current_user)


@router.post("/adjust-stock")
async def adjust_stock(
    payload: StockAdjustmentRequest,
    current_user: User = Depends(require_permission("ADJUST_STOCK")),
    db: AsyncSession = Depends(get_db),
):
    return await service.adjust_stock(db, payload.batch_id, payload.quantity, payload.reason, current_user)


@router.get("/stock-report")
async def stock_report(
    current_user: User = Depends(require_permission("VIEW_STOCK")),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_stock_report(db)


@router.get("/batches/{batch_id}/movements")
async def batch_movements(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movements = await service.get_batch_movement_history(db, batch_id)
    return [
        {
            "id": m.id,
            "movement_type": m.movement_type,
            "quantity": m.quantity,
            "performed_by": m.performed_by,
            "remarks": m.remarks,
            "created_at": m.created_at,
        }
        for m in movements
    ]


@router.get("/batches/{batch_id}/label")
async def download_quarantine_label(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.get_batch_by_id(db, batch_id)
    label_data = {
        "batch_id": batch.id,
        "material_name": batch.material.material_name if batch.material else "",
        "batch_number": batch.batch_number,
        "grn_number": batch.grn.grn_number if batch.grn else "",
        "pack_size": str(batch.pack_size or ""),
        "total_quantity": str(batch.total_quantity),
        "unit": batch.material.unit_of_measure if batch.material else "kg",
        "manufacture_date": str(batch.manufacture_date or ""),
        "expiry_date": str(batch.expiry_date or ""),
        "supplier_name": batch.supplier.supplier_name if batch.supplier else "",
        "qr_path": batch.qr_code_path or "",
    }
    pdf_path = generate_quarantine_label(label_data)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"quarantine_label_{batch.batch_number}.pdf")
