from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_permission
from app.models.user_models import User
from app.qa import service
from app.qa.schemas import InspectFGRequest, ApproveFGRequest, RejectFGRequest

router = APIRouter()


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
