from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.finished_goods_models import FinishedGoodsBatch, QAInspection, FGStatus, QAInspectionStatus
from app.models.user_models import User
from app.audit.service import log_action, audit_status_value


async def inspect_fg(db: AsyncSession, fg_batch_id: int, quantity_verified, remarks: str | None, inspected_by: User) -> QAInspection:
    fg = await db.get(FinishedGoodsBatch, fg_batch_id)
    if not fg:
        raise HTTPException(status_code=404, detail="FG batch not found")

    if fg.status != FGStatus.QA_PENDING:
        raise HTTPException(status_code=400, detail=f"FG batch status is {fg.status}. Must be QA_PENDING for inspection.")

    inspection = QAInspection(
        fg_batch_id=fg.id,
        quantity_verified=quantity_verified,
        status=QAInspectionStatus.PENDING,
        inspection_remarks=remarks,
        inspected_by=inspected_by.id,
    )
    db.add(inspection)

    await log_action(
        db, "INSPECT_FG", inspected_by.id, inspected_by.username,
        "fg_batch", fg.id,
        f"QA inspection submitted for FG batch {fg.batch_number}",
    )
    await db.commit()
    await db.refresh(inspection)
    return inspection


async def approve_fg(db: AsyncSession, fg_batch_id: int, remarks: str | None, approved_by: User) -> FinishedGoodsBatch:
    fg = await db.get(FinishedGoodsBatch, fg_batch_id)
    if not fg:
        raise HTTPException(status_code=404, detail="FG batch not found")

    if fg.status != FGStatus.QA_PENDING:
        raise HTTPException(status_code=400, detail=f"FG batch must be QA_PENDING to approve. Current: {fg.status}")

    fg.status = FGStatus.QA_APPROVED

    # Update inspection record if exists
    inspection_result = await db.execute(
        select(QAInspection).where(QAInspection.fg_batch_id == fg_batch_id).order_by(QAInspection.created_at.desc())
    )
    inspection = inspection_result.scalar_one_or_none()
    if inspection:
        inspection.status = QAInspectionStatus.PASSED
        inspection.approved_rejected_by = approved_by.id
        inspection.completed_at = datetime.utcnow()
        if remarks:
            inspection.inspection_remarks = remarks

    await log_action(
        db, "APPROVE_FG", approved_by.id, approved_by.username,
        "fg_batch", fg.id,
        f"FG batch {fg.batch_number} approved by QA",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(fg.status),
    )
    await db.commit()
    await db.refresh(fg)
    return fg


async def reject_fg(db: AsyncSession, fg_batch_id: int, remarks: str, rejected_by: User) -> FinishedGoodsBatch:
    fg = await db.get(FinishedGoodsBatch, fg_batch_id)
    if not fg:
        raise HTTPException(status_code=404, detail="FG batch not found")

    if fg.status != FGStatus.QA_PENDING:
        raise HTTPException(status_code=400, detail=f"FG batch must be QA_PENDING to reject. Current: {fg.status}")

    old_status = fg.status
    fg.status = FGStatus.QA_REJECTED

    inspection_result = await db.execute(
        select(QAInspection).where(QAInspection.fg_batch_id == fg_batch_id).order_by(QAInspection.created_at.desc())
    )
    inspection = inspection_result.scalar_one_or_none()
    if inspection:
        inspection.status = QAInspectionStatus.FAILED
        inspection.approved_rejected_by = rejected_by.id
        inspection.completed_at = datetime.utcnow()
        inspection.inspection_remarks = remarks

    await log_action(
        db, "REJECT_FG", rejected_by.id, rejected_by.username,
        "fg_batch", fg.id,
        f"FG batch {fg.batch_number} rejected by QA. Reason: {remarks}",
        from_status=audit_status_value(old_status),
        to_status=audit_status_value(fg.status),
    )
    await db.commit()
    await db.refresh(fg)
    return fg
