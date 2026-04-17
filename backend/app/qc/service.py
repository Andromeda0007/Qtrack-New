import logging
from datetime import datetime, date

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.inventory_models import (
    Batch, BatchStatus, BatchStatusHistory, StockMovement, MovementType, Location, Material
)
from app.models.qc_models import QCResult, RetestCycle, GradeTransfer, TestStatus, RetestStatus, GradeTransferStatus
from app.models.user_models import User
from app.audit.service import log_action, audit_status_value

logger = logging.getLogger(__name__)


async def _batch_display_info(db: AsyncSession, batch_id: int) -> dict:
    """Fetch GRN number + material name for notification messages."""
    from app.models.inventory_models import GRN
    result = await db.execute(
        select(Batch)
        .options(selectinload(Batch.material), selectinload(Batch.grn))
        .where(Batch.id == batch_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        return {"grn": f"batch-{batch_id}", "material_name": "unknown"}
    return {
        "grn": (b.grn.grn_number if b.grn else None) or b.batch_number or f"batch-{batch_id}",
        "material_name": (b.material.material_name if b.material else "unknown"),
    }


async def _get_batch_locked(db: AsyncSession, batch_id: int) -> Batch:
    result = await db.execute(
        select(Batch).where(Batch.id == batch_id).with_for_update()
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


async def _update_batch_status(
    db: AsyncSession,
    batch: Batch,
    new_status: BatchStatus,
    changed_by: int,
    remarks: str | None = None,
    location_type: str | None = None,
) -> None:
    old_status = batch.status
    batch.status = new_status

    if location_type:
        loc = await db.execute(select(Location).where(Location.location_type == location_type))
        loc_obj = loc.scalar_one_or_none()
        if loc_obj:
            batch.location_id = loc_obj.id

    history = BatchStatusHistory(
        batch_id=batch.id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        remarks=remarks,
    )
    db.add(history)


async def add_ar_number(db: AsyncSession, data: dict, done_by: User) -> QCResult:
    batch = await _get_batch_locked(db, data["batch_id"])

    if batch.status not in [BatchStatus.QUARANTINE, BatchStatus.QUARANTINE_RETEST]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add AR number — batch status is {batch.status}. Must be QUARANTINE or QUARANTINE_RETEST.",
        )

    # Check AR number not duplicate
    existing = await db.execute(select(QCResult).where(QCResult.ar_number == data["ar_number"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="AR number already exists")

    qc_result = QCResult(
        batch_id=batch.id,
        ar_number=data["ar_number"],
        sample_quantity=data.get("sample_quantity"),
        test_status=TestStatus.UNDER_TEST,
        sample_taken_by=done_by.id,
    )
    db.add(qc_result)

    # Deduct sample only when registering quantity here (optional if sample was withdrawn earlier via WITHDRAW_SAMPLE)
    sq = data.get("sample_quantity")
    if sq is not None and sq > 0:
        if batch.remaining_quantity < sq:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient quantity for sample. Available: {batch.remaining_quantity}",
            )
        batch.remaining_quantity -= sq
        movement = StockMovement(
            batch_id=batch.id,
            movement_type=MovementType.QC_SAMPLE,
            quantity=sq,
            performed_by=done_by.id,
            remarks=f"QC sample withdrawal for AR {data['ar_number']}",
        )
        db.add(movement)

    old_status = batch.status
    await _update_batch_status(db, batch, BatchStatus.UNDER_TEST, done_by.id, "QC sampling initiated", "TESTING")

    # Audit: only the status move (quarantine → under test); AR/sample details stay in QC tables.
    await log_action(
        db, "ADD_AR_NUMBER", done_by.id, done_by.username,
        "batch", batch.id,
        "Quarantine → under test",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles
        info = await _batch_display_info(db, batch.id)
        await notify_roles(
            db,
            ["QC_HEAD"],
            "Item under test",
            f"{info['grn']} · {info['material_name']} — AR {data['ar_number']}. "
            f"Awaiting approval/rejection.",
            entity_type="batch",
            entity_id=batch.id,
        )
    except Exception as e:
        logger.warning("Under-test notification failed: %s", e)

    await db.commit()
    await db.refresh(qc_result)
    return qc_result


async def withdraw_sample(
    db: AsyncSession,
    batch_id: int,
    sample_quantity,
    remarks: str | None,
    done_by: User,
) -> dict:
    """Physical sample withdrawal while batch stays in quarantine / retest quarantine (before AR / under test)."""
    batch = await _get_batch_locked(db, batch_id)

    if batch.status not in [BatchStatus.QUARANTINE, BatchStatus.QUARANTINE_RETEST]:
        raise HTTPException(
            status_code=400,
            detail=f"Sample withdrawal allowed only in quarantine. Current status: {batch.status}",
        )

    if sample_quantity <= 0:
        raise HTTPException(status_code=400, detail="Sample quantity must be positive")

    if batch.remaining_quantity < sample_quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient quantity. Available: {batch.remaining_quantity}",
        )

    batch.remaining_quantity -= sample_quantity
    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.QC_SAMPLE,
        quantity=sample_quantity,
        performed_by=done_by.id,
        remarks=remarks or "QC sample withdrawn (pre-AR)",
    )
    db.add(movement)

    await log_action(
        db,
        "WITHDRAW_SAMPLE",
        done_by.id,
        done_by.username,
        "batch",
        batch.id,
        f"Withdrew sample qty {sample_quantity} from batch {batch.batch_number}. Remaining: {batch.remaining_quantity}",
        from_status=audit_status_value(batch.status),
        to_status=audit_status_value(batch.status),
    )
    await db.commit()
    await db.refresh(batch)
    return {"batch_id": batch.id, "remaining_quantity": batch.remaining_quantity}


async def approve_material(db: AsyncSession, batch_id: int, retest_date: date | None, remarks: str | None, approved_by: User) -> Batch:
    if not retest_date:
        raise HTTPException(status_code=400, detail="Retesting date is mandatory for approval")

    batch = await _get_batch_locked(db, batch_id)

    if batch.status != BatchStatus.UNDER_TEST:
        raise HTTPException(status_code=400, detail=f"Batch must be UNDER_TEST to approve. Current: {batch.status}")

    # Update latest QC result
    qc_result = await db.execute(
        select(QCResult).where(QCResult.batch_id == batch_id).order_by(QCResult.created_at.desc())
    )
    qc = qc_result.scalar_one_or_none()
    if qc:
        qc.test_status = TestStatus.APPROVED
        qc.retest_date = retest_date
        qc.approved_rejected_by = approved_by.id
        qc.approved_rejected_at = datetime.utcnow()
        qc.test_remarks = remarks

    batch.retest_date = retest_date
    batch.retest_cycle = (batch.retest_cycle or 0)  # Preserve cycle count

    old_status = batch.status
    await _update_batch_status(db, batch, BatchStatus.APPROVED, approved_by.id, remarks or "QC Approved", "APPROVED")

    await log_action(
        db, "APPROVE_MATERIAL", approved_by.id, approved_by.username,
        "batch", batch.id,
        f"Batch {batch.batch_number} approved. Retest date: {retest_date}",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles
        info = await _batch_display_info(db, batch.id)
        await notify_roles(
            db,
            ["WAREHOUSE_USER", "WAREHOUSE_HEAD"],
            "Item approved",
            f"{info['grn']} · {info['material_name']} — approved. "
            f"Ready to move to Production.",
            entity_type="batch",
            entity_id=batch.id,
        )
    except Exception as e:
        logger.warning("Approval notification failed: %s", e)

    await db.commit()
    await db.refresh(batch)
    return batch


async def reject_material(db: AsyncSession, batch_id: int, remarks: str, rejected_by: User) -> Batch:
    batch = await _get_batch_locked(db, batch_id)

    if batch.status != BatchStatus.UNDER_TEST:
        raise HTTPException(status_code=400, detail=f"Batch must be UNDER_TEST to reject. Current: {batch.status}")

    qc_result = await db.execute(
        select(QCResult).where(QCResult.batch_id == batch_id).order_by(QCResult.created_at.desc())
    )
    qc = qc_result.scalar_one_or_none()
    if qc:
        qc.test_status = TestStatus.REJECTED
        qc.approved_rejected_by = rejected_by.id
        qc.approved_rejected_at = datetime.utcnow()
        qc.test_remarks = remarks

    old_status = batch.status
    await _update_batch_status(db, batch, BatchStatus.REJECTED, rejected_by.id, remarks, "REJECTED")

    await log_action(
        db, "REJECT_MATERIAL", rejected_by.id, rejected_by.username,
        "batch", batch.id,
        f"Batch {batch.batch_number} rejected. Reason: {remarks}",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles
        info = await _batch_display_info(db, batch.id)
        await notify_roles(
            db,
            ["WAREHOUSE_USER", "WAREHOUSE_HEAD"],
            "Item rejected",
            f"{info['grn']} · {info['material_name']} — rejected. Remarks: {remarks}",
            entity_type="batch",
            entity_id=batch.id,
        )
    except Exception as e:
        logger.warning("Rejection notification failed: %s", e)

    await db.commit()
    await db.refresh(batch)
    return batch


async def initiate_retest(db: AsyncSession, batch_id: int, remarks: str | None, initiated_by: User) -> RetestCycle:
    batch = await _get_batch_locked(db, batch_id)

    if batch.status != BatchStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only APPROVED batches can be moved to retesting")

    batch.retest_cycle = (batch.retest_cycle or 0) + 1

    retest = RetestCycle(
        batch_id=batch.id,
        cycle_number=batch.retest_cycle,
        retest_date=batch.retest_date or datetime.utcnow().date(),
        status=RetestStatus.IN_PROGRESS,
        initiated_by=initiated_by.id,
        remarks=remarks,
    )
    db.add(retest)

    old_status = batch.status
    await _update_batch_status(db, batch, BatchStatus.QUARANTINE_RETEST, initiated_by.id, remarks, "QUARANTINE")

    await log_action(
        db, "INITIATE_RETEST", initiated_by.id, initiated_by.username,
        "batch", batch.id,
        f"Retesting cycle {batch.retest_cycle} initiated for batch {batch.batch_number}",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(batch.status),
    )

    try:
        from app.notifications.service import notify_roles
        info = await _batch_display_info(db, batch.id)
        await notify_roles(
            db,
            ["QC_EXECUTIVE", "WAREHOUSE_HEAD"],
            "Retest requested",
            f"{info['grn']} · {info['material_name']} — retest cycle {batch.retest_cycle} requested.",
            entity_type="batch",
            entity_id=batch.id,
        )
    except Exception as e:
        logger.warning("Retest notification failed: %s", e)

    await db.commit()
    await db.refresh(retest)
    return retest


async def complete_retest(db: AsyncSession, batch_id: int, approved: bool, retest_date: date | None, remarks: str | None, done_by: User) -> Batch:
    batch = await _get_batch_locked(db, batch_id)

    if batch.status != BatchStatus.UNDER_TEST:
        raise HTTPException(status_code=400, detail="Batch must be UNDER_TEST to complete retest")

    retest_result = await db.execute(
        select(RetestCycle)
        .where(RetestCycle.batch_id == batch_id, RetestCycle.status == RetestStatus.IN_PROGRESS)
        .order_by(RetestCycle.created_at.desc())
    )
    retest = retest_result.scalar_one_or_none()

    if approved:
        if not retest_date:
            raise HTTPException(status_code=400, detail="New retest date is required for approval")
        batch.retest_date = retest_date
        new_status = BatchStatus.APPROVED
        if retest:
            retest.status = RetestStatus.APPROVED
    else:
        new_status = BatchStatus.REJECTED
        if retest:
            retest.status = RetestStatus.REJECTED

    if retest:
        retest.completed_by = done_by.id
        retest.completed_at = datetime.utcnow()
        retest.remarks = remarks

    old_status = batch.status
    await _update_batch_status(db, batch, new_status, done_by.id, remarks, "APPROVED" if approved else "REJECTED")

    action = "RETEST_APPROVED" if approved else "RETEST_REJECTED"
    await log_action(
        db, action, done_by.id, done_by.username, "batch", batch.id,
        f"Retest cycle {batch.retest_cycle} {'approved' if approved else 'rejected'}",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(batch.status),
    )
    await db.commit()
    await db.refresh(batch)
    return batch


async def request_grade_transfer(db: AsyncSession, batch_id: int, new_material_id: int, reason: str, requested_by: User) -> GradeTransfer:
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch.status != BatchStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only APPROVED batches can undergo grade transfer")

    old_material = await db.get(Material, batch.material_id)
    new_material = await db.get(Material, new_material_id)
    if not new_material:
        raise HTTPException(status_code=404, detail="New material not found")

    transfer = GradeTransfer(
        batch_id=batch.id,
        old_material_code=old_material.material_code if old_material else "",
        new_material_code=new_material.material_code,
        old_material_id=batch.material_id,
        new_material_id=new_material_id,
        reason=reason,
        status=GradeTransferStatus.PENDING,
        requested_by=requested_by.id,
    )
    db.add(transfer)

    await log_action(
        db, "REQUEST_GRADE_TRANSFER", requested_by.id, requested_by.username,
        "batch", batch.id,
        f"Grade transfer requested: {old_material.material_code if old_material else '?'} → {new_material.material_code}",
    )
    await db.commit()
    await db.refresh(transfer)
    return transfer


async def approve_grade_transfer(db: AsyncSession, transfer_id: int, remarks: str | None, approved_by: User) -> GradeTransfer:
    transfer = await db.get(GradeTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Grade transfer not found")

    if transfer.status != GradeTransferStatus.PENDING:
        raise HTTPException(status_code=400, detail="Transfer is not in PENDING state")

    batch = await _get_batch_locked(db, transfer.batch_id)

    # Update batch's material
    old_material_id = batch.material_id
    batch.material_id = transfer.new_material_id

    # Record movement
    movement = StockMovement(
        batch_id=batch.id,
        movement_type=MovementType.GRADE_TRANSFER,
        quantity=batch.remaining_quantity,
        performed_by=approved_by.id,
        reference_id=str(transfer_id),
        remarks=f"Grade transfer: {transfer.old_material_code} → {transfer.new_material_code}",
    )
    db.add(movement)

    transfer.status = GradeTransferStatus.APPROVED
    transfer.approved_by = approved_by.id
    transfer.approved_at = datetime.utcnow()

    await log_action(
        db, "APPROVE_GRADE_TRANSFER", approved_by.id, approved_by.username,
        "batch", batch.id,
        f"Grade transfer approved: {transfer.old_material_code} → {transfer.new_material_code}",
    )
    await db.commit()
    await db.refresh(transfer)
    return transfer


async def get_pending_grade_transfers(db: AsyncSession) -> list:
    result = await db.execute(
        select(GradeTransfer).where(GradeTransfer.status == GradeTransferStatus.PENDING)
    )
    return result.scalars().all()
