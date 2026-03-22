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
from app.models.finished_goods_models import FGStatus
from app.utils.qr_generator import generate_batch_qr, get_qr_base64
from app.utils.batch_public_code import generate_unique_public_code, normalize_public_code_input
from app.audit.service import log_action, audit_status_value


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

    public_code = await generate_unique_public_code(db)

    rack = (data.get("rack_number") or "").strip()
    if not rack:
        raise HTTPException(
            status_code=400,
            detail="Quarantine rack / storage location is required when creating a product card.",
        )

    batch = Batch(
        material_id=material.id,
        supplier_id=supplier.id,
        batch_number=data["batch_number"],
        public_code=public_code,
        manufacturer_name=data.get("manufacturer_name"),
        manufacture_date=data.get("manufacture_date"),
        expiry_date=data.get("expiry_date"),
        pack_size=data.get("container_quantity"),
        pack_type=PackType(data.get("pack_type", "BAG").upper()),
        pack_size_description=(
            (data.get("pack_size_description") or "").strip() or None
        ),
        total_quantity=data["total_quantity"],
        remaining_quantity=data["total_quantity"],
        status=BatchStatus.QUARANTINE,
        location_id=quarantine.id if quarantine else None,
        rack_number=rack,
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
        qr_path = generate_batch_qr(batch.id, batch.batch_number, batch.public_code)
        batch.qr_code_path = qr_path
        qr_base64 = get_qr_base64(qr_path)
    except Exception as e:
        logger.warning("QR generation failed: %s", e)

    await log_action(
        db, "CREATE_PRODUCT",
        created_by.id, created_by.username,
        "batch", batch.id,
        f"Card created — Product {data['grn_number']}, Batch {batch.batch_number}",
        from_status=None,
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles

        await notify_roles(
            db,
            ["WAREHOUSE_HEAD", "WAREHOUSE_USER", "QC_HEAD"],
            "Material inward — quarantine",
            f"GRN {data['grn_number']} | Batch {batch.batch_number} | {material.material_name} received into quarantine.",
            entity_type="batch",
            entity_id=batch.id,
        )
    except Exception as e:
        logger.warning("Inward notification failed: %s", e)

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
        "qr_data": f"QTRACK|BATCH|{batch.id}|{batch.batch_number}|{batch.public_code}",
        "public_code": batch.public_code,
        "track_id": f"#{batch.public_code}",
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
    """Resolve batch from full QTRACK QR payload or from 8-char public code (optional #)."""
    from app.utils.qr_generator import parse_qr_data

    slug = normalize_public_code_input(qr_data)
    if slug:
        r = await db.execute(select(Batch.id).where(Batch.public_code == slug))
        bid = r.scalar_one_or_none()
        if not bid:
            raise HTTPException(status_code=404, detail="Unknown tracking code")
        return await get_batch_by_id(db, bid)

    try:
        parsed = parse_qr_data(qr_data.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if parsed["entity_type"] != "BATCH":
        raise HTTPException(status_code=400, detail="QR code is not a batch QR")

    return await get_batch_by_id(db, parsed["entity_id"])


def _batch_status_str(batch: Batch) -> str:
    s = batch.status
    return s.value if hasattr(s, "value") else str(s)


def remaining_quantity_for_api(batch: Batch) -> str | None:
    """Client spec: show remaining quantity only for approved / issued-to-production."""
    st = _batch_status_str(batch)
    if st in ("APPROVED", "ISSUED_TO_PRODUCTION"):
        return str(batch.remaining_quantity)
    return None


def pack_type_display(batch: Batch) -> str:
    pt = batch.pack_type
    return pt.value if hasattr(pt, "value") else str(pt)


def _user_is_qa_role(user: User | None) -> bool:
    if not user or not user.role:
        return False
    return user.role.role_name in ("QA_EXECUTIVE", "QA_HEAD")


def _batch_scan_payload(
    b: Batch,
    current_user: User | None,
) -> dict:
    qty_issued = b.total_quantity - b.remaining_quantity
    if qty_issued < 0:
        qty_issued = Decimal(0)
    st = _batch_status_str(b)
    show_balances = st in ("APPROVED", "ISSUED_TO_PRODUCTION")
    rem = str(b.remaining_quantity) if show_balances else None
    qi = str(qty_issued) if show_balances else None
    payload = {
        "qr_kind": "batch",
        "id": b.id,
        "batch_number": b.batch_number,
        "public_code": b.public_code,
        "track_id": f"#{b.public_code}",
        "material_name": b.material.material_name if b.material else None,
        "material_code": b.material.material_code if b.material else None,
        "supplier_name": b.supplier.supplier_name if b.supplier else None,
        "grn_number": b.grn.grn_number if b.grn else None,
        "date_of_receipt": str(b.grn.received_date) if b.grn and b.grn.received_date else None,
        "pack_type": pack_type_display(b),
        "pack_size": str(b.pack_size) if b.pack_size is not None else None,
        "pack_size_description": b.pack_size_description,
        "manufacture_date": str(b.manufacture_date) if b.manufacture_date else None,
        "expiry_date": str(b.expiry_date) if b.expiry_date else None,
        "status": st,
        "total_quantity": str(b.total_quantity),
        "quantity_issued": qi,
        "remaining_quantity": rem,
        "remaining_quantity_hidden": not show_balances,
        "retest_date": str(b.retest_date) if b.retest_date else None,
        "retest_cycle": b.retest_cycle,
        "ar_number": b.qc_results[-1].ar_number if b.qc_results else None,
        "rack_number": b.rack_number,
    }
    if _user_is_qa_role(current_user):
        payload["qa_scan_blocked"] = True
        payload["qa_scan_message"] = (
            "Raw material is handled by QC only. For QA, scan a finished goods (FG) barcode — "
            "not a raw material batch."
        )
    return payload


async def resolve_scan_payload(db: AsyncSession, qr_data: str, current_user: User | None = None) -> dict:
    """Parse QTRACK QR (BATCH or FG), or 8-char public code, for the mobile scanner."""
    from app.utils.qr_generator import parse_qr_data
    from app.production.service import get_fg_batch_by_id

    slug = normalize_public_code_input(qr_data)
    if slug:
        r = await db.execute(
            select(Batch)
            .where(Batch.public_code == slug)
            .options(
                selectinload(Batch.material),
                selectinload(Batch.supplier),
                selectinload(Batch.grn),
                selectinload(Batch.qc_results),
            )
        )
        b = r.scalar_one_or_none()
        if not b:
            raise HTTPException(status_code=404, detail="Unknown tracking code")
        return _batch_scan_payload(b, current_user)

    try:
        parsed = parse_qr_data(qr_data.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if parsed["entity_type"] == "BATCH":
        b = await get_batch_by_id(db, parsed["entity_id"])
        return _batch_scan_payload(b, current_user)

    if parsed["entity_type"] == "FG":
        fg = await get_fg_batch_by_id(db, parsed["entity_id"])
        st = fg.status.value if hasattr(fg.status, "value") else str(fg.status)
        payload = {
            "qr_kind": "fg",
            "id": fg.id,
            "batch_number": fg.batch_number,
            "product_name": fg.product_name,
            "status": st,
            "quantity": str(fg.quantity),
            "expiry_date": str(fg.expiry_date) if fg.expiry_date else None,
            "manufacture_date": str(fg.manufacture_date) if fg.manufacture_date else None,
            "net_weight": str(fg.net_weight) if fg.net_weight is not None else None,
            "remarks": fg.remarks,
        }
        if _user_is_qa_role(current_user) and st != FGStatus.QA_PENDING.value:
            payload["qa_scan_blocked"] = True
            payload["qa_scan_message"] = (
                "This finished good is not pending QA inspection. "
                f"Current status: {st.replace('_', ' ')}. "
                "QA can only process FG batches that are **QA pending** (awaiting inspection / approval)."
            )
        return payload

    raise HTTPException(status_code=400, detail="Unsupported QR type")


async def issue_stock(
    db: AsyncSession,
    batch_id: int,
    quantity: Decimal,
    remarks: str | None,
    issued_by: User,
    issued_to_product_name: str | None = None,
    issued_to_batch_ref: str | None = None,
) -> dict:
    from app.models.qc_models import GradeTransfer, GradeTransferStatus

    result = await db.execute(
        select(Batch).where(Batch.id == batch_id).with_for_update()
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    pending_gt = await db.execute(
        select(GradeTransfer.id).where(
            GradeTransfer.batch_id == batch_id,
            GradeTransfer.status == GradeTransferStatus.PENDING,
        )
    )
    if pending_gt.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot issue — a code-to-code (grade) transfer is pending QC release. "
                "Wait for QC to approve the transfer."
            ),
        )

    if batch.status not in (BatchStatus.APPROVED, BatchStatus.ISSUED_TO_PRODUCTION):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot issue stock — batch status is {batch.status}. "
                "Only approved material (or partial dispense in progress) can be issued."
            ),
        )

    if not (batch.rack_number or "").strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "Rack number must be recorded before issuing to production. "
                "Set or confirm the rack location, then issue again."
            ),
        )

    if batch.remaining_quantity < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {batch.remaining_quantity}, Requested: {quantity}",
        )

    prod_loc = await db.execute(select(Location).where(Location.location_type == "PRODUCTION"))
    production = prod_loc.scalar_one_or_none()

    old_status = batch.status
    batch.remaining_quantity -= quantity
    if batch.status == BatchStatus.APPROVED:
        batch.status = BatchStatus.ISSUED_TO_PRODUCTION

    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.ISSUE_TO_PRODUCTION,
        quantity=quantity,
        from_location_id=batch.location_id,
        to_location_id=production.id if production else None,
        performed_by=issued_by.id,
        issued_to_product_name=issued_to_product_name,
        issued_to_batch_ref=issued_to_batch_ref,
        remarks=remarks,
    )
    db.add(movement)

    desc = (
        f"Issued {quantity} to production from batch {batch.batch_number}. Remaining: {batch.remaining_quantity}"
    )
    if issued_to_product_name:
        desc += f". Product: {issued_to_product_name}"
    if issued_to_batch_ref:
        desc += f". Mfg batch ref: {issued_to_batch_ref}"

    await log_action(
        db,
        "ISSUE_STOCK",
        issued_by.id,
        issued_by.username,
        "batch",
        batch.id,
        desc,
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles

        await notify_roles(
            db,
            ["WAREHOUSE_HEAD", "QC_HEAD"],
            "Material outward — issue to production",
            f"Issued {quantity} from batch {batch.batch_number}. Balance: {batch.remaining_quantity}.",
            entity_type="batch",
            entity_id=batch.id,
        )
    except Exception as e:
        logger.warning("Outward notification failed: %s", e)

    await db.commit()
    return {
        "batch_id": batch.id,
        "quantity_issued": quantity,
        "remaining": batch.remaining_quantity,
        "status": _batch_status_str(batch),
    }


async def update_batch_rack(
    db: AsyncSession, batch_id: int, rack_number: str, updated_by: User
) -> Batch:
    from app.models.qc_models import GradeTransfer, GradeTransferStatus

    batch = await get_batch_by_id(db, batch_id)
    if batch.status not in (BatchStatus.APPROVED, BatchStatus.ISSUED_TO_PRODUCTION):
        raise HTTPException(
            status_code=400,
            detail=(
                "Rack can only be set while material is approved or partially issued to production. "
                f"Current status: {batch.status}"
            ),
        )
    pending_gt = await db.execute(
        select(GradeTransfer.id).where(
            GradeTransfer.batch_id == batch_id,
            GradeTransfer.status == GradeTransferStatus.PENDING,
        )
    )
    if pending_gt.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Cannot update rack while a grade (code-to-code) transfer is pending QC release.",
        )
    batch.rack_number = rack_number.strip() if rack_number else None
    await db.commit()
    await db.refresh(batch)
    return batch


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
            "public_code": b.public_code,
            "track_id": f"#{b.public_code}",
            "pack_size_description": b.pack_size_description,
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
