import uuid
from decimal import Decimal
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.inventory_models import (
    Batch, GRN, BatchStatusHistory, StockMovement,
    BatchStatus, MovementType, Location, Material, Supplier
)
from app.models.qc_models import QCResult
from app.models.user_models import User
from app.utils.qr_generator import generate_batch_qr
from app.audit.service import log_action


def _generate_grn_number() -> str:
    return f"GRN-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


async def create_grn(db: AsyncSession, data: dict, created_by: User) -> Batch:
    # Validate material exists
    material = await db.get(Material, data["material_id"])
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Validate batch number uniqueness
    existing = await db.execute(select(Batch).where(Batch.batch_number == data["batch_number"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Batch number already exists")

    # Get quarantine location
    q_loc = await db.execute(select(Location).where(Location.location_type == "QUARANTINE"))
    quarantine = q_loc.scalar_one_or_none()

    # Create batch
    batch = Batch(
        material_id=data["material_id"],
        supplier_id=data.get("supplier_id"),
        batch_number=data["batch_number"],
        manufacture_date=data.get("manufacture_date"),
        expiry_date=data.get("expiry_date"),
        pack_size=data.get("pack_size"),
        pack_type=data.get("pack_type", "BAG"),
        total_quantity=data["total_quantity"],
        remaining_quantity=data["total_quantity"],
        status=BatchStatus.QUARANTINE,
        location_id=quarantine.id if quarantine else None,
        created_by=created_by.id,
        remarks=data.get("remarks"),
    )
    db.add(batch)
    await db.flush()

    # Generate GRN number
    grn_number = _generate_grn_number()
    grn = GRN(
        batch_id=batch.id,
        grn_number=grn_number,
        received_by=created_by.id,
        invoice_number=data.get("invoice_number"),
        remarks=data.get("remarks"),
    )
    db.add(grn)

    # Initial stock movement
    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.GRN_RECEIVED,
        quantity=data["total_quantity"],
        to_location_id=quarantine.id if quarantine else None,
        performed_by=created_by.id,
        reference_id=grn_number,
        remarks=f"GRN receipt - {grn_number}",
    )
    db.add(movement)

    # Status history
    history = BatchStatusHistory(
        batch_id=batch.id,
        old_status=None,
        new_status=BatchStatus.QUARANTINE,
        changed_by=created_by.id,
        remarks="Initial GRN receipt",
    )
    db.add(history)

    await db.flush()

    # Generate QR code
    qr_path = generate_batch_qr(batch.id, batch.batch_number)
    batch.qr_code_path = qr_path

    await log_action(
        db, "CREATE_GRN",
        created_by.id, created_by.username,
        "batch", batch.id,
        f"GRN {grn_number} created for batch {batch.batch_number} ({data['total_quantity']} {material.unit_of_measure})",
    )

    await db.commit()
    await db.refresh(batch)
    return batch


async def get_batch_by_id(db: AsyncSession, batch_id: int) -> Batch:
    result = await db.execute(
        select(Batch)
        .where(Batch.id == batch_id)
        .options(
            selectinload(Batch.material),
            selectinload(Batch.supplier),
            selectinload(Batch.grn),
            selectinload(Batch.qc_results),
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


async def get_batch_by_qr(db: AsyncSession, qr_data: str) -> Batch:
    """Parse QR string and return batch."""
    from app.utils.qr_generator import parse_qr_data
    try:
        parsed = parse_qr_data(qr_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if parsed["entity_type"] != "BATCH":
        raise HTTPException(status_code=400, detail="QR code is not a batch QR")

    return await get_batch_by_id(db, parsed["entity_id"])


async def issue_stock(db: AsyncSession, batch_id: int, quantity: Decimal, remarks: str | None, issued_by: User) -> dict:
    # Use row-level lock (pessimistic locking)
    result = await db.execute(
        select(Batch).where(Batch.id == batch_id).with_for_update()
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch.status != BatchStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot issue stock — batch status is {batch.status}. Only APPROVED batches can be issued.",
        )

    if batch.remaining_quantity < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {batch.remaining_quantity}, Requested: {quantity}",
        )

    # Get production location
    prod_loc = await db.execute(select(Location).where(Location.location_type == "PRODUCTION"))
    production = prod_loc.scalar_one_or_none()

    batch.remaining_quantity -= quantity

    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.ISSUE_TO_PRODUCTION,
        quantity=quantity,
        from_location_id=batch.location_id,
        to_location_id=production.id if production else None,
        performed_by=issued_by.id,
        remarks=remarks,
    )
    db.add(movement)

    await log_action(
        db, "ISSUE_STOCK",
        issued_by.id, issued_by.username,
        "batch", batch.id,
        f"Issued {quantity} to production from batch {batch.batch_number}. Remaining: {batch.remaining_quantity}",
    )
    await db.commit()
    return {"batch_id": batch.id, "quantity_issued": quantity, "remaining": batch.remaining_quantity}


async def adjust_stock(db: AsyncSession, batch_id: int, quantity: Decimal, reason: str, adjusted_by: User) -> dict:
    result = await db.execute(select(Batch).where(Batch.id == batch_id).with_for_update())
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    new_qty = batch.remaining_quantity + quantity
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Adjustment would result in negative stock")

    batch.remaining_quantity = new_qty

    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.ADJUSTMENT,
        quantity=quantity,
        performed_by=adjusted_by.id,
        remarks=f"Stock adjustment: {reason}",
    )
    db.add(movement)

    await log_action(
        db, "ADJUST_STOCK",
        adjusted_by.id, adjusted_by.username,
        "batch", batch.id,
        f"Stock adjusted by {quantity} for batch {batch.batch_number}. Reason: {reason}",
    )
    await db.commit()
    return {"batch_id": batch.id, "adjustment": quantity, "new_remaining": batch.remaining_quantity}


async def get_all_batches(db: AsyncSession, status: str | None = None, material_id: int | None = None) -> list:
    query = (
        select(Batch)
        .options(selectinload(Batch.material), selectinload(Batch.supplier), selectinload(Batch.grn))
        .order_by(Batch.created_at.desc())
    )
    if status:
        query = query.where(Batch.status == status)
    if material_id:
        query = query.where(Batch.material_id == material_id)

    result = await db.execute(query)
    return result.scalars().all()


async def get_stock_report(db: AsyncSession) -> list:
    result = await db.execute(
        select(Batch)
        .options(
            selectinload(Batch.material),
            selectinload(Batch.supplier),
            selectinload(Batch.grn),
            selectinload(Batch.qc_results),
        )
        .where(Batch.remaining_quantity > 0)
        .order_by(Batch.expiry_date.asc())
    )
    batches = result.scalars().all()

    report = []
    for b in batches:
        ar_number = b.qc_results[-1].ar_number if b.qc_results else None
        report.append({
            "batch_number": b.batch_number,
            "material_name": b.material.material_name if b.material else "",
            "material_code": b.material.material_code if b.material else "",
            "supplier_name": b.supplier.supplier_name if b.supplier else None,
            "grn_number": b.grn.grn_number if b.grn else None,
            "total_quantity": b.total_quantity,
            "remaining_quantity": b.remaining_quantity,
            "status": b.status,
            "expiry_date": b.expiry_date,
            "retest_date": b.retest_date,
            "retest_cycle": b.retest_cycle,
            "ar_number": ar_number,
        })
    return report


async def get_batch_movement_history(db: AsyncSession, batch_id: int) -> list:
    result = await db.execute(
        select(StockMovement)
        .where(StockMovement.batch_id == batch_id)
        .order_by(StockMovement.created_at.asc())
    )
    return result.scalars().all()
