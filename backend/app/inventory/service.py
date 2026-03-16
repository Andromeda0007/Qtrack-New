import logging
from decimal import Decimal

from fastapi import HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.inventory_models import (
    Batch, GRN, BatchStatusHistory, StockMovement,
    BatchStatus, MovementType, PackType, Location, Material, Supplier
)
from app.models.user_models import User
from app.utils.qr_generator import generate_batch_qr, get_qr_base64
from app.audit.service import log_action


async def _get_or_create_material(db: AsyncSession, item_code: str, item_name: str) -> Material:
    result = await db.execute(select(Material).where(Material.material_code == item_code.strip()))
    material = result.scalar_one_or_none()
    if not material:
        material = Material(
            material_name=item_name.strip(),
            material_code=item_code.strip(),
            unit_of_measure="pcs",
        )
        db.add(material)
        await db.flush()
    return material


async def _get_or_create_supplier(db: AsyncSession, supplier_name: str) -> Supplier:
    result = await db.execute(
        select(Supplier).where(func.lower(Supplier.supplier_name) == supplier_name.lower().strip())
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        supplier = Supplier(supplier_name=supplier_name.strip())
        db.add(supplier)
        await db.flush()
    return supplier


async def create_product(db: AsyncSession, data: dict, created_by: User) -> dict:
    # Get or create material by item_code
    material = await _get_or_create_material(db, data["item_code"], data["item_name"])

    # Get or create supplier
    supplier = await _get_or_create_supplier(db, data["supplier_name"])

    # Validate batch_number uniqueness
    existing_batch = await db.execute(select(Batch).where(Batch.batch_number == data["batch_number"]))
    if existing_batch.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Batch number '{data['batch_number']}' already exists")

    # Validate product number uniqueness
    existing_grn = await db.execute(select(GRN).where(GRN.grn_number == data["grn_number"]))
    if existing_grn.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Product number '{data['grn_number']}' already exists")

    # Get quarantine location
    q_loc = await db.execute(select(Location).where(Location.location_type == "QUARANTINE"))
    quarantine = q_loc.scalar_one_or_none()

    batch = Batch(
        material_id=material.id,
        supplier_id=supplier.id,
        batch_number=data["batch_number"],
        manufacturer_name=data.get("manufacturer_name"),
        manufacture_date=data.get("manufacture_date"),
        expiry_date=data.get("expiry_date"),
        pack_size=data.get("container_quantity"),
        pack_type=PackType(data.get("pack_type", "BAG").upper()),
        total_quantity=data["total_quantity"],
        remaining_quantity=data["total_quantity"],
        status=BatchStatus.QUARANTINE,
        location_id=quarantine.id if quarantine else None,
        created_by=created_by.id,
    )
    db.add(batch)
    await db.flush()

    grn = GRN(
        batch_id=batch.id,
        grn_number=data["grn_number"],
        received_by=created_by.id,
        received_date=data.get("date_of_receipt"),
    )
    db.add(grn)

    # Initial stock movement
    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.GRN_RECEIVED,
        quantity=data["total_quantity"],
        to_location_id=quarantine.id if quarantine else None,
        performed_by=created_by.id,
        reference_id=data["grn_number"],
        remarks=f"Product receipt - {data['grn_number']}",
    )
    db.add(movement)

    # Status history
    history = BatchStatusHistory(
        batch_id=batch.id,
        old_status=None,
        new_status=BatchStatus.QUARANTINE,
        changed_by=created_by.id,
        remarks="Initial product receipt",
    )
    db.add(history)

    await db.flush()

    # Generate QR code (non-blocking — failures don't abort the product creation)
    qr_base64 = ""
    try:
        qr_path = generate_batch_qr(batch.id, batch.batch_number)
        batch.qr_code_path = qr_path
        qr_base64 = get_qr_base64(qr_path)
    except Exception as e:
        logger.warning("QR generation failed: %s", e)

    await log_action(
        db, "CREATE_PRODUCT",
        created_by.id, created_by.username,
        "batch", batch.id,
        f"Card created — Product {data['grn_number']}, Batch {batch.batch_number}",
    )

    await db.commit()
    await db.refresh(batch)

    return {
        "batch": batch,
        "material": material,
        "supplier": supplier,
        "grn_number": data["grn_number"],
        "manufacturer_name": data.get("manufacturer_name", ""),
        "date_of_receipt": str(data.get("date_of_receipt", "")),
        "qr_base64": qr_base64,
        "qr_data": f"QTRACK|BATCH|{batch.id}|{batch.batch_number}",
    }


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
