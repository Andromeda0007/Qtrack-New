from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_permission, get_current_user
from app.models.user_models import User
from app.finished_goods import service
from app.finished_goods.schemas import ReceiveFGRequest, DispatchRequest

router = APIRouter()


@router.post("/receive")
async def receive_fg(
    payload: ReceiveFGRequest,
    current_user: User = Depends(require_permission("RECEIVE_FG")),
    db: AsyncSession = Depends(get_db),
):
    inventory = await service.receive_fg(db, payload.fg_batch_id, payload.location_id, current_user)
    return {"message": "FG received into warehouse", "inventory_id": inventory.id, "quantity": inventory.quantity}


@router.post("/dispatch")
async def dispatch_fg(
    payload: DispatchRequest,
    current_user: User = Depends(require_permission("DISPATCH_FG")),
    db: AsyncSession = Depends(get_db),
):
    dispatch = await service.dispatch_fg(db, payload.model_dump(), current_user)
    return {
        "message": "Dispatch recorded",
        "dispatch_id": dispatch.id,
        "customer": dispatch.customer_name,
        "quantity": dispatch.quantity,
    }


@router.get("/inventory")
async def fg_inventory(
    current_user: User = Depends(require_permission("VIEW_STOCK")),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_fg_inventory(db)
