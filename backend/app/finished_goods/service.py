from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.finished_goods_models import (
    FinishedGoodsBatch, FGInventory, DispatchRecord, FGStatus
)
from app.models.inventory_models import Location
from app.models.user_models import User
from app.audit.service import log_action


async def receive_fg(db: AsyncSession, fg_batch_id: int, location_id: int | None, received_by: User) -> FGInventory:
    fg = await db.get(FinishedGoodsBatch, fg_batch_id)
    if not fg:
        raise HTTPException(status_code=404, detail="FG batch not found")

    if fg.status != FGStatus.QA_APPROVED:
        raise HTTPException(status_code=400, detail=f"FG batch must be QA_APPROVED before warehouse receipt. Current: {fg.status}")

    # Get FG storage location if not specified
    if not location_id:
        loc = await db.execute(select(Location).where(Location.location_type == "FG_STORAGE"))
        loc_obj = loc.scalar_one_or_none()
        location_id = loc_obj.id if loc_obj else None

    inventory = FGInventory(
        fg_batch_id=fg.id,
        location_id=location_id,
        quantity=fg.quantity,
        received_by=received_by.id,
    )
    db.add(inventory)

    fg.status = FGStatus.WAREHOUSE_RECEIVED

    await log_action(
        db, "RECEIVE_FG", received_by.id, received_by.username,
        "fg_batch", fg.id,
        f"FG batch {fg.batch_number} received into warehouse ({fg.quantity} units)",
    )
    await db.commit()
    await db.refresh(inventory)
    return inventory


async def dispatch_fg(db: AsyncSession, data: dict, dispatched_by: User) -> DispatchRecord:
    fg = await db.get(FinishedGoodsBatch, data["fg_batch_id"])
    if not fg:
        raise HTTPException(status_code=404, detail="FG batch not found")

    if fg.status != FGStatus.WAREHOUSE_RECEIVED:
        raise HTTPException(status_code=400, detail=f"FG batch must be in WAREHOUSE_RECEIVED state. Current: {fg.status}")

    # Check inventory
    inv_result = await db.execute(
        select(FGInventory).where(FGInventory.fg_batch_id == data["fg_batch_id"]).with_for_update()
    )
    inventory = inv_result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=400, detail="No inventory record found for this FG batch")

    if inventory.quantity < data["quantity"]:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient FG stock. Available: {inventory.quantity}, Requested: {data['quantity']}",
        )

    inventory.quantity -= data["quantity"]

    dispatch = DispatchRecord(
        fg_batch_id=fg.id,
        customer_name=data["customer_name"],
        quantity=data["quantity"],
        dispatch_date=data.get("dispatch_date") or datetime.utcnow().date(),
        invoice_number=data.get("invoice_number"),
        remarks=data.get("remarks"),
        dispatched_by=dispatched_by.id,
    )
    db.add(dispatch)

    if inventory.quantity == 0:
        fg.status = FGStatus.DISPATCHED

    await log_action(
        db, "DISPATCH_FG", dispatched_by.id, dispatched_by.username,
        "fg_batch", fg.id,
        f"Dispatched {data['quantity']} units of FG batch {fg.batch_number} to {data['customer_name']}",
    )
    await db.commit()
    await db.refresh(dispatch)
    return dispatch


async def get_fg_inventory(db: AsyncSession) -> list:
    result = await db.execute(
        select(FinishedGoodsBatch, FGInventory)
        .join(FGInventory, FGInventory.fg_batch_id == FinishedGoodsBatch.id, isouter=True)
        .where(FinishedGoodsBatch.status == FGStatus.WAREHOUSE_RECEIVED)
    )
    rows = result.all()
    return [
        {
            "fg_batch_id": fg.id,
            "product_name": fg.product_name,
            "batch_number": fg.batch_number,
            "expiry_date": fg.expiry_date,
            "warehouse_quantity": inv.quantity if inv else 0,
            "status": fg.status,
        }
        for fg, inv in rows
    ]
