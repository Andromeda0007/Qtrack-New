from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import require_permission, get_current_user
from app.models.user_models import User
from app.models.finished_goods_models import FinishedGoodsBatch
from app.qa import service
from app.qa.schemas import InspectFGRequest, ApproveFGRequest, RejectFGRequest

router = APIRouter()


@router.get("/fg-batches")
async def list_fg_batches(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(FinishedGoodsBatch).order_by(FinishedGoodsBatch.created_at.desc())
    if status:
        query = query.where(FinishedGoodsBatch.status == status)
    result = await db.execute(query)
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "product_name": b.product_name,
            "batch_number": b.batch_number,
            "manufacture_date": b.manufacture_date,
            "expiry_date": b.expiry_date,
            "quantity": str(b.quantity),
            "carton_count": b.carton_count,
            "net_weight": str(b.net_weight) if b.net_weight else None,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in batches
    ]


@router.post("/inspect")
async def inspect_fg(
    payload: InspectFGRequest,
    current_user: User = Depends(require_permission("INSPECT_FG")),
    db: AsyncSession = Depends(get_db),
):
    inspection = await service.inspect_fg(
        db, payload.fg_batch_id, payload.quantity_verified, payload.inspection_remarks, current_user
    )
    return {"message": "Inspection recorded", "inspection_id": inspection.id}


@router.post("/approve")
async def approve_fg(
    payload: ApproveFGRequest,
    current_user: User = Depends(require_permission("APPROVE_FG")),
    db: AsyncSession = Depends(get_db),
):
    fg = await service.approve_fg(db, payload.fg_batch_id, payload.remarks, current_user)
    return {"message": "FG batch approved by QA", "fg_batch_id": fg.id, "status": fg.status}


@router.post("/reject")
async def reject_fg(
    payload: RejectFGRequest,
    current_user: User = Depends(require_permission("REJECT_FG")),
    db: AsyncSession = Depends(get_db),
):
    fg = await service.reject_fg(db, payload.fg_batch_id, payload.remarks, current_user)
    return {"message": "FG batch rejected by QA", "fg_batch_id": fg.id, "status": fg.status}
