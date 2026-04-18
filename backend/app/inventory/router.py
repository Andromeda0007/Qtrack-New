import os
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Query, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal

from app.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user_models import User
from app.models.inventory_models import BatchStatus
from app.inventory import service
from app.inventory.schemas import GRNCreate, ProductCreate, IssueStockRequest, StockAdjustmentRequest, UpdateRackRequest
from app.utils.pdf_generator import generate_quarantine_label
from app.config import settings

logger = logging.getLogger(__name__)


def _pre_generate_labels(batch_id: int, batch_data: dict, container_dicts: list) -> None:
    """Sync background task: pre-build the container-labels PDF after GRN creation."""
    try:
        from app.utils.pdf_generator import generate_container_labels
        generate_container_labels(batch_data, container_dicts)
    except Exception as exc:
        logger.warning("Label pre-generation failed for batch %s: %s", batch_id, exc)

router = APIRouter()


@router.post("/product")
async def create_product(
    payload: GRNCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission("CREATE_PRODUCT")),
    db: AsyncSession = Depends(get_db),
):
    """Create a GRN (Goods Receipt Note) with per-container identifiers.

    URL preserved as ``/product`` for backward compatibility with the mobile
    client; logically this is "Create GRN" in the new Warehouse terminology.
    """
    result = await service.create_product(db, payload.model_dump(), current_user)
    batch = result["batch"]
    material = result["material"]
    supplier = result["supplier"]

    # Pre-generate the container-labels PDF in background so first Print tap is fast
    _bg_batch_data = {
        "batch_id": batch.id,
        "grn_number": result["grn_number"],
        "material_code": material.material_code,
        "material_name": material.material_name,
        "batch_number": batch.batch_number,
        "pack_type": service.pack_type_display(batch),
        "container_quantity": result["container_quantity"],
        "unit_of_measure": result["unit_of_measure"],
        "manufacture_date": str(batch.manufacture_date) if batch.manufacture_date else "",
        "expiry_date": str(batch.expiry_date) if batch.expiry_date else "",
        "supplier_name": supplier.supplier_name,
        "manufacturer_name": result["manufacturer_name"],
    }
    _bg_containers = [
        {"container_number": c["container_number"], "unique_code": c["unique_code"], "qr_code_path": None}
        for c in result["containers"]
    ]
    background_tasks.add_task(_pre_generate_labels, batch.id, _bg_batch_data, _bg_containers)

    return {
        "message": "GRN created successfully",
        "batch_id": batch.id,
        "item_code": material.material_code,
        "item_name": material.material_name,
        "batch_number": batch.batch_number,
        "grn_number": result["grn_number"],
        "unit_of_measure": result["unit_of_measure"],
        "container_count": result["container_count"],
        "container_quantity": result["container_quantity"],
        "total_quantity": result["total_quantity"],
        "pack_type": service.pack_type_display(batch),
        "supplier_name": supplier.supplier_name,
        "manufacturer_name": result["manufacturer_name"],
        "date_of_receipt": result["date_of_receipt"],
        "manufacture_date": str(batch.manufacture_date) if batch.manufacture_date else "",
        "expiry_date": str(batch.expiry_date) if batch.expiry_date else "",
        "status": batch.status,
        "created_at": str(batch.created_at),
        "qr_data": result["qr_data"],
        "qr_base64": result["qr_base64"],
        "containers": result["containers"],
        # Legacy fields kept so the in-flight mobile app doesn't crash during rollout:
        "public_code": result["public_code"],
        "track_id": f"#{result['public_code']}",
    }


@router.get("/batches")
async def list_batches(
    status: Optional[str] = Query(None),
    statuses: Optional[str] = Query(None),  # comma-separated e.g. "QUARANTINE,QUARANTINE_RETEST"
    material_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    statuses_list = [s.strip() for s in statuses.split(",")] if statuses else None
    batches = await service.get_all_batches(db, status, material_id, statuses_list)
    return [
        {
            "id": b.id,
            "batch_number": b.batch_number,
            "material_name": b.material.material_name if b.material else None,
            "material_code": b.material.material_code if b.material else None,
            "supplier_name": b.supplier.supplier_name if b.supplier else None,
            "grn_number": b.grn.grn_number if b.grn else None,
            "total_quantity": b.total_quantity,
            "remaining_quantity": service.remaining_quantity_for_api(b),
            "unit_of_measure": getattr(b, "unit_of_measure", "KG"),
            "container_count": getattr(b, "container_count", None),
            "container_quantity": getattr(b, "container_quantity", None),
            "status": b.status,
            "expiry_date": b.expiry_date,
            "retest_date": b.retest_date,
            "retest_cycle": b.retest_cycle,
            "rack_number": b.rack_number,
            "pack_type": service.pack_type_display(b),
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

    # QR base64 — regenerate if file was lost (Render ephemeral FS)
    from app.utils.qr_generator import generate_batch_qr, get_qr_base64
    qr_b64 = ""
    qr_path = batch.qr_code_path
    try:
        if qr_path and os.path.exists(qr_path):
            qr_b64 = get_qr_base64(qr_path)
        elif getattr(batch, "public_code", None):
            qr_path = generate_batch_qr(batch.id, batch.batch_number, batch.public_code)
            qr_b64 = get_qr_base64(qr_path)
    except Exception:
        pass

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
        "pack_type": service.pack_type_display(batch),
        "unit_of_measure": getattr(batch, "unit_of_measure", "KG"),
        "container_count": getattr(batch, "container_count", None),
        "container_quantity": getattr(batch, "container_quantity", None),
        "total_quantity": batch.total_quantity,
        "remaining_quantity": service.remaining_quantity_for_api(batch),
        "status": batch.status,
        "retest_date": batch.retest_date,
        "retest_cycle": batch.retest_cycle,
        "labels_printed": getattr(batch, "labels_printed", False),
        "qr_base64": qr_b64,
        "ar_number": getattr(batch, "ar_number", None),
        "rack_number": batch.rack_number,
    }


@router.get("/scan/{qr_data}")
async def scan_qr(
    qr_data: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve material batch QR or finished-goods FG QR (`QTRACK|BATCH|…` / `QTRACK|FG|…`)."""
    return await service.resolve_scan_payload(db, qr_data, current_user)


@router.post("/issue-stock")
async def issue_stock(
    payload: IssueStockRequest,
    current_user: User = Depends(require_permission("ISSUE_STOCK")),
    db: AsyncSession = Depends(get_db),
):
    return await service.issue_stock(
        db,
        payload.batch_id,
        payload.quantity,
        payload.remarks,
        current_user,
        issued_to_product_name=payload.issued_to_product_name,
        issued_to_batch_ref=payload.issued_to_batch_ref,
    )


@router.patch("/batches/{batch_id}/rack")
async def update_batch_rack(
    batch_id: int,
    payload: UpdateRackRequest,
    current_user: User = Depends(require_permission("UPDATE_LOCATION")),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.update_batch_rack(db, batch_id, payload.rack_number, current_user)
    return {"batch_id": batch.id, "rack_number": batch.rack_number}


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
        "per_container_qty": str(batch.pack_size or ""),
        "pack_type": service.pack_type_display(batch),
        "pack_size_description": batch.pack_size_description or "",
        "total_quantity": str(batch.total_quantity),
        "unit": batch.material.unit_of_measure if batch.material else "kg",
        "manufacture_date": str(batch.manufacture_date or ""),
        "expiry_date": str(batch.expiry_date or ""),
        "supplier_name": batch.supplier.supplier_name if batch.supplier else "",
        "qr_path": batch.qr_code_path or "",
        "track_id": f"#{batch.public_code}",
        "public_code": batch.public_code,
    }
    pdf_path = generate_quarantine_label(label_data)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"quarantine_label_{batch.batch_number}.pdf")


@router.get("/batches/{batch_id}/label-retest")
async def download_retest_quarantine_label(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """New quarantine label for material in QUARANTINE_RETEST (per client retest SOP)."""
    batch = await service.get_batch_by_id(db, batch_id)
    st = batch.status.value if hasattr(batch.status, "value") else str(batch.status)
    if st != BatchStatus.QUARANTINE_RETEST.value:
        raise HTTPException(
            status_code=400,
            detail="Retest label is only for batches in QUARANTINE (RETESTING).",
        )
    ar_number = getattr(batch, "ar_number", "") or ""
    label_data = {
        "batch_id": batch.id,
        "material_name": batch.material.material_name if batch.material else "",
        "batch_number": batch.batch_number,
        "grn_number": batch.grn.grn_number if batch.grn else "",
        "pack_size": str(batch.pack_size or ""),
        "per_container_qty": str(batch.pack_size or ""),
        "pack_type": service.pack_type_display(batch),
        "pack_size_description": batch.pack_size_description or "",
        "total_quantity": str(batch.total_quantity),
        "unit": batch.material.unit_of_measure if batch.material else "kg",
        "manufacture_date": str(batch.manufacture_date or ""),
        "expiry_date": str(batch.expiry_date or ""),
        "supplier_name": batch.supplier.supplier_name if batch.supplier else "",
        "qr_path": batch.qr_code_path or "",
        "track_id": f"#{batch.public_code}",
        "public_code": batch.public_code,
        "ar_number": ar_number,
        "retest_ref": f"Cycle {batch.retest_cycle}",
    }
    pdf_path = generate_quarantine_label(label_data, variant="retest")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"quarantine_retest_{batch.batch_number}.pdf",
    )


@router.get("/batches/{batch_id}/container-labels")
async def get_container_labels(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Multi-page PDF with one label per container."""
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    from app.models.inventory_models import Batch, BatchContainer
    from app.utils.pdf_generator import generate_container_labels

    result = await db.execute(
        select(Batch)
        .options(
            selectinload(Batch.material),
            selectinload(Batch.supplier),
            selectinload(Batch.grn),
            selectinload(Batch.containers),
        )
        .where(Batch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    containers = sorted(batch.containers or [], key=lambda x: x.container_number)
    if not containers:
        raise HTTPException(status_code=404, detail="Batch has no containers")

    batch_data = {
        "batch_id": batch.id,
        "grn_number": batch.grn.grn_number if batch.grn else None,
        "material_code": batch.material.material_code if batch.material else "",
        "material_name": batch.material.material_name if batch.material else "",
        "batch_number": batch.batch_number,
        "pack_type": service.pack_type_display(batch),
        "container_quantity": str(batch.container_quantity) if getattr(batch, "container_quantity", None) else "",
        "unit_of_measure": getattr(batch, "unit_of_measure", "KG"),
        "manufacture_date": str(batch.manufacture_date) if batch.manufacture_date else "",
        "expiry_date": str(batch.expiry_date) if batch.expiry_date else "",
        "supplier_name": batch.supplier.supplier_name if batch.supplier else "",
        "manufacturer_name": getattr(batch, "manufacturer_name", "") or "",
    }
    container_dicts = [
        {
            "container_number": c.container_number,
            "unique_code": c.unique_code,
            "qr_code_path": c.qr_code_path,
        }
        for c in containers
    ]

    # Serve the exact PDF that was originally generated, stored in DB
    if getattr(batch, "labels_pdf", None):
        from fastapi.responses import Response
        return Response(
            content=batch.labels_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="container_labels_{batch.batch_number}.pdf"'},
        )

    # First time — generate, store bytes in DB, return
    pdf_path = await run_in_threadpool(generate_container_labels, batch_data, container_dicts)
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    batch.labels_pdf = pdf_bytes
    await db.commit()

    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="container_labels_{batch.batch_number}.pdf"'},
    )


@router.post("/batches/{batch_id}/mark-labels-printed")
async def mark_labels_printed(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    batch.labels_printed = True
    await db.commit()
    return {"ok": True}
