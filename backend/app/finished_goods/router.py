from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_permission, get_current_user
from app.models.user_models import User
from app.finished_goods import service
from app.finished_goods.schemas import ReceiveFGRequest, DispatchRequest

router = APIRouter()


@router.get("/batches")
async def list_fg_batches_for_warehouse(
    status: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("VIEW_STOCK")),
    db: AsyncSession = Depends(get_db),
):
    """List FG batches by status — used by warehouse for receive/dispatch workflows."""
    from sqlalchemy import select
    from app.models.finished_goods_models import FinishedGoodsBatch, FGInventory
    query = select(FinishedGoodsBatch).order_by(FinishedGoodsBatch.created_at.desc())
    if status:
        query = query.where(FinishedGoodsBatch.status == status)
    result = await db.execute(query)
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "fgtn_no": b.fgtn_no,
            "product_name": b.product_name,
            "batch_number": b.batch_number,
            "pack_size": b.pack_size,
            "expiry_date": b.expiry_date,
            "quantity": b.quantity,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in batches
    ]


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
