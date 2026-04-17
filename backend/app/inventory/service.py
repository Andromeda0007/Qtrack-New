import logging
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.inventory_models import (
    Batch, GRN, BatchStatusHistory, StockMovement,
    BatchStatus, MovementType, PackType, Location, Material, Supplier,
    BatchContainer, GRNCounter,
)
from app.models.user_models import User
from app.models.finished_goods_models import FGStatus
from app.utils.qr_generator import (
    generate_batch_qr, generate_container_qr, get_qr_base64,
)
from app.utils.batch_public_code import generate_unique_public_code, normalize_public_code_input
from app.audit.service import log_action, audit_status_value

# Allowed rounding slack when validating Total == Containers × Per for KG mode.
_QTY_TOLERANCE_KG = Decimal("0.001")


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


async def _allocate_next_grn_number(db: AsyncSession, year: int | None = None) -> str:
    """Race-safe GRN-YYYY-NNN allocation (resets each calendar year)."""
    year = year or datetime.utcnow().year
    # SELECT ... FOR UPDATE on the year row. If missing, create it.
    row = await db.execute(
        select(GRNCounter).where(GRNCounter.year == year).with_for_update()
    )
    counter = row.scalar_one_or_none()
    if counter is None:
        counter = GRNCounter(year=year, last_number=0)
        db.add(counter)
        await db.flush()
        row = await db.execute(
            select(GRNCounter).where(GRNCounter.year == year).with_for_update()
        )
        counter = row.scalar_one()
    counter.last_number += 1
    return f"GRN-{year}-{counter.last_number:03d}"


def _validate_quantities(uom: str, total: Decimal, count: int, per: Decimal) -> None:
    """Validate total = count × per under the unit's rules."""
    expected = Decimal(count) * per
    if uom == "KG":
        if abs(expected - total) > _QTY_TOLERANCE_KG:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Quantity mismatch: {count} × {per} = {expected}, "
                    f"but total = {total} (tolerance ±{_QTY_TOLERANCE_KG} kg)"
                ),
            )
    elif uom == "COUNT":
        if per != per.to_integral_value() or total != total.to_integral_value():
            raise HTTPException(
                status_code=400,
                detail="COUNT mode requires integer values for total and qty per container",
            )
        if expected != total:
            raise HTTPException(
                status_code=400,
                detail=f"Quantity mismatch: {count} × {per} = {expected}, total = {total}",
            )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown unit_of_measure '{uom}'")


async def create_product(db: AsyncSession, data: dict, created_by: User) -> dict:
    # 1. Resolve Material from the picker (reject inactive)
    material = await db.get(Material, int(data["material_id"]))
    if not material:
        raise HTTPException(status_code=404, detail="Selected item not found")
    if not material.is_active:
        raise HTTPException(status_code=400, detail="Selected item is deactivated; ask Warehouse Head to re-activate it")

    # 2. Quantity validation
    uom = (data.get("unit_of_measure") or "KG").upper()
    total_q = Decimal(str(data["total_quantity"]))
    container_q = Decimal(str(data["container_quantity"]))
    container_count = int(data["container_count"])
    _validate_quantities(uom, total_q, container_count, container_q)

    # 3. Batch number uniqueness (still user-supplied, still globally unique for now)
    existing_batch = await db.execute(
        select(Batch).where(Batch.batch_number == data["batch_number"])
    )
    if existing_batch.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Batch number '{data['batch_number']}' already exists",
        )

    # 4. Supplier (free-text; auto-upsert for now)
    supplier = await _get_or_create_supplier(db, data["supplier_name"])

    # 5. Quarantine location
    q_loc = await db.execute(select(Location).where(Location.location_type == "QUARANTINE"))
    quarantine = q_loc.scalar_one_or_none()

    # 6. Backend-generated identifiers
    grn_number = await _allocate_next_grn_number(db)
    public_code = await generate_unique_public_code(db)  # kept for legacy-scanner fallback

    # 7. Create Batch
    batch = Batch(
        material_id=material.id,
        supplier_id=supplier.id,
        batch_number=data["batch_number"],
        public_code=public_code,
        manufacturer_name=data.get("manufacturer_name"),
        manufacture_date=data.get("manufacture_date"),
        expiry_date=data.get("expiry_date"),
        pack_size=None,
        pack_type=PackType(data.get("pack_type", "BAG").upper()),
        pack_size_description=None,
        unit_of_measure=uom,
        container_count=container_count,
        container_quantity=container_q,
        total_quantity=total_q,
        remaining_quantity=total_q,
        status=BatchStatus.QUARANTINE,
        location_id=quarantine.id if quarantine else None,
        rack_number=None,  # rack is assigned post-approval, not at GRN time
        created_by=created_by.id,
    )
    db.add(batch)
    await db.flush()

    # 8. GRN row
    grn = GRN(
        batch_id=batch.id,
        grn_number=grn_number,
        received_by=created_by.id,
        received_date=data.get("date_of_receipt"),
    )
    db.add(grn)

    # 9. Per-container rows (unique_code = GRN-YYYY-NNN-CCC)
    containers: list[BatchContainer] = []
    for idx in range(1, container_count + 1):
        containers.append(BatchContainer(
            batch_id=batch.id,
            container_number=idx,
            unique_code=f"{grn_number}-{idx:03d}",
        ))
    db.add_all(containers)

    # 10. Initial stock movement (entire batch into quarantine)
    db.add(StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.GRN_RECEIVED,
        quantity=total_q,
        to_location_id=quarantine.id if quarantine else None,
        performed_by=created_by.id,
        reference_id=grn_number,
        remarks=f"Received — {grn_number}",
    ))

    # 11. Status history
    db.add(BatchStatusHistory(
        batch_id=batch.id,
        old_status=None,
        new_status=BatchStatus.QUARANTINE,
        changed_by=created_by.id,
        remarks="Initial receipt into quarantine",
    ))

    await db.flush()

    # 12. QR generation — one representative (batch-level) + one per container.
    #     All non-blocking: any QR failures get logged but don't abort.
    qr_base64 = ""
    try:
        qr_path = generate_batch_qr(batch.id, batch.batch_number, batch.public_code)
        batch.qr_code_path = qr_path
        qr_base64 = get_qr_base64(qr_path)
    except Exception as e:
        logger.warning("Batch-level QR generation failed: %s", e)

    container_payload: list[dict] = []
    for c in containers:
        b64 = ""
        try:
            path = generate_container_qr(batch.id, c.container_number, c.unique_code)
            c.qr_code_path = path
            b64 = get_qr_base64(path)
        except Exception as e:
            logger.warning(
                "Container QR gen failed (batch=%s, container=%s): %s",
                batch.id, c.container_number, e,
            )
        container_payload.append({
            "container_number": c.container_number,
            "unique_code": c.unique_code,
            "qr_base64": b64,
        })

    await log_action(
        db, "CREATE_GRN",
        created_by.id, created_by.username,
        "batch", batch.id,
        f"GRN {grn_number} created — {material.material_code} {material.material_name} · "
        f"{container_count} container(s) · {total_q} {uom}",
        from_status=None,
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles

        await notify_roles(
            db,
            ["WAREHOUSE_HEAD", "WAREHOUSE_USER", "QC_HEAD"],
            "Material inward — quarantine",
            f"{grn_number} | Batch {batch.batch_number} | {material.material_name} "
            f"({container_count} container · {total_q} {uom}) received into quarantine.",
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
        "grn_number": grn_number,
        "unit_of_measure": uom,
        "container_count": container_count,
        "container_quantity": str(container_q),
        "total_quantity": str(total_q),
        "manufacturer_name": data.get("manufacturer_name", ""),
        "date_of_receipt": str(data.get("date_of_receipt", "")),
        "qr_base64": qr_base64,
        "qr_data": f"QTRACK|BATCH|{batch.id}|{batch.batch_number}|{batch.public_code}",
        "public_code": batch.public_code,
        "containers": container_payload,
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
        "track_id": f"#{b.public_code}" if b.public_code else None,
        "material_name": b.material.material_name if b.material else None,
        "material_code": b.material.material_code if b.material else None,
        "supplier_name": b.supplier.supplier_name if b.supplier else None,
        "grn_number": b.grn.grn_number if b.grn else None,
        "date_of_receipt": str(b.grn.received_date) if b.grn and b.grn.received_date else None,
        "pack_type": pack_type_display(b),
        "unit_of_measure": getattr(b, "unit_of_measure", "KG") or "KG",
        "container_count": getattr(b, "container_count", None),
        "container_quantity": (
            str(b.container_quantity) if getattr(b, "container_quantity", None) is not None else None
        ),
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


import re as _re
_CONTAINER_CODE_RE = _re.compile(r"^GRN-\d{4}-\d{3,}-\d{3,}$")


async def _resolve_container_code(db: AsyncSession, code: str) -> dict | None:
    """Try to resolve a container-level unique code and return its scan payload.

    Returns None if the code is not a container code (caller falls back to
    batch / FG resolution). Container QR payloads carry an extra
    ``container_number`` / ``container_total`` so the scanner can show
    ``Container 47 / 100``.
    """
    stripped = code.strip()
    if stripped.startswith("QTRACK|CNT|"):
        stripped = stripped[len("QTRACK|CNT|"):]
    if not _CONTAINER_CODE_RE.match(stripped):
        return None

    r = await db.execute(
        select(BatchContainer).where(BatchContainer.unique_code == stripped)
    )
    container = r.scalar_one_or_none()
    if not container:
        raise HTTPException(status_code=404, detail="Unknown container code")

    b = await get_batch_by_id(db, container.batch_id)
    payload = _batch_scan_payload(b, None)  # caller adds role gate below
    payload["qr_kind"] = "container"
    payload["container_number"] = container.container_number
    payload["container_total"] = b.container_count
    payload["container_unique_code"] = container.unique_code
    payload["is_lost"] = container.is_lost
    return payload


async def resolve_scan_payload(db: AsyncSession, qr_data: str, current_user: User | None = None) -> dict:
    """Parse QTRACK QR (CONTAINER, BATCH or FG) or 8-char legacy public code."""
    from app.utils.qr_generator import parse_qr_data
    from app.production.service import get_fg_batch_by_id

    # 1) Container-level code (new in Warehouse Phase 1.A)
    container_payload = await _resolve_container_code(db, qr_data)
    if container_payload is not None:
        if _user_is_qa_role(current_user):
            container_payload["qa_scan_blocked"] = True
            container_payload["qa_scan_message"] = (
                "Raw material is handled by QC only. For QA, scan a finished goods (FG) "
                "barcode — not a raw material container."
            )
        return container_payload

    # 2) Legacy 8-char public code
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
