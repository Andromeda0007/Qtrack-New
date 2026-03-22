from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_permission, get_current_user
from app.models.user_models import User
from app.qc import service
from app.qc.schemas import (
    AddARNumberRequest,
    WithdrawSampleRequest,
    ApproveRejectRequest,
    RejectRequest,
    InitiateRetestRequest,
    GradeTransferRequest,
    ApproveGradeTransferRequest,
    RetestApproveRejectRequest,
)

router = APIRouter()


@router.post("/ar-number")
async def add_ar_number(
    payload: AddARNumberRequest,
    current_user: User = Depends(require_permission("GENERATE_AR_NUMBER")),
    db: AsyncSession = Depends(get_db),
):
    qc = await service.add_ar_number(db, payload.model_dump(), current_user)
    return {
        "message": "AR number added and batch moved to UNDER_TEST",
        "qc_result_id": qc.id,
        "ar_number": qc.ar_number,
    }


@router.post("/withdraw-sample")
async def withdraw_sample(
    payload: WithdrawSampleRequest,
    current_user: User = Depends(require_permission("WITHDRAW_SAMPLE")),
    db: AsyncSession = Depends(get_db),
):
    return await service.withdraw_sample(
        db,
        payload.batch_id,
        payload.sample_quantity,
        payload.remarks,
        current_user,
    )


@router.post("/approve")
async def approve_material(
    payload: ApproveRejectRequest,
    current_user: User = Depends(require_permission("APPROVE_MATERIAL")),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.approve_material(db, payload.batch_id, payload.retest_date, payload.remarks, current_user)
    return {
        "message": "Material approved",
        "batch_id": batch.id,
        "batch_number": batch.batch_number,
        "status": batch.status,
        "retest_date": batch.retest_date,
    }


@router.post("/reject")
async def reject_material(
    payload: RejectRequest,
    current_user: User = Depends(require_permission("REJECT_MATERIAL")),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.reject_material(db, payload.batch_id, payload.remarks, current_user)
    return {
        "message": "Material rejected",
        "batch_id": batch.id,
        "batch_number": batch.batch_number,
        "status": batch.status,
    }


@router.post("/initiate-retest")
async def initiate_retest(
    payload: InitiateRetestRequest,
    current_user: User = Depends(require_permission("INITIATE_RETEST")),
    db: AsyncSession = Depends(get_db),
):
    retest = await service.initiate_retest(db, payload.batch_id, payload.remarks, current_user)
    return {
        "message": "Retesting initiated",
        "retest_cycle_id": retest.id,
        "cycle_number": retest.cycle_number,
        "status": retest.status,
    }


@router.post("/complete-retest")
async def complete_retest(
    payload: RetestApproveRejectRequest,
    current_user: User = Depends(require_permission("APPROVE_MATERIAL")),
    db: AsyncSession = Depends(get_db),
):
    batch = await service.complete_retest(
        db, payload.batch_id, payload.approved, payload.retest_date, payload.remarks, current_user
    )
    return {
        "message": "Retest completed",
        "batch_id": batch.id,
        "status": batch.status,
        "new_retest_date": batch.retest_date,
    }


@router.post("/grade-transfer/request")
async def request_grade_transfer(
    payload: GradeTransferRequest,
    current_user: User = Depends(require_permission("REQUEST_GRADE_TRANSFER")),
    db: AsyncSession = Depends(get_db),
):
    transfer = await service.request_grade_transfer(
        db, payload.batch_id, payload.new_material_id, payload.reason, current_user
    )
    return {
        "message": "Grade transfer requested",
        "transfer_id": transfer.id,
        "old_material_code": transfer.old_material_code,
        "new_material_code": transfer.new_material_code,
        "status": transfer.status,
    }


@router.post("/grade-transfer/approve")
async def approve_grade_transfer(
    payload: ApproveGradeTransferRequest,
    current_user: User = Depends(require_permission("APPROVE_GRADE_TRANSFER")),
    db: AsyncSession = Depends(get_db),
):
    transfer = await service.approve_grade_transfer(db, payload.transfer_id, payload.remarks, current_user)
    return {
        "message": "Grade transfer approved",
        "transfer_id": transfer.id,
        "status": transfer.status,
    }


@router.get("/grade-transfer/pending")
async def pending_grade_transfers(
    current_user: User = Depends(require_permission("APPROVE_GRADE_TRANSFER")),
    db: AsyncSession = Depends(get_db),
):
    transfers = await service.get_pending_grade_transfers(db)
    return [
        {
            "id": t.id,
            "batch_id": t.batch_id,
            "old_material_code": t.old_material_code,
            "new_material_code": t.new_material_code,
            "reason": t.reason,
            "requested_by": t.requested_by,
            "created_at": t.created_at,
        }
        for t in transfers
    ]
