from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.finished_goods_models import FinishedGoodsBatch, FGStatus
from app.models.user_models import User
from app.utils.qr_generator import generate_fg_qr
from app.utils.pdf_generator import generate_shipper_label
from app.audit.service import log_action, audit_status_value


async def create_fg_batch(db: AsyncSession, data: dict, created_by: User) -> FinishedGoodsBatch:
    # Check batch number uniqueness
    existing = await db.execute(
        select(FinishedGoodsBatch).where(FinishedGoodsBatch.batch_number == data["batch_number"])
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="FG batch number already exists")

    fg_batch = FinishedGoodsBatch(
        product_name=data["product_name"],
        batch_number=data["batch_number"],
        manufacture_date=data["manufacture_date"],
        expiry_date=data["expiry_date"],
        net_weight=data.get("net_weight"),
        gross_weight=data.get("gross_weight"),
        quantity=data["quantity"],
        carton_count=data.get("carton_count"),
        status=FGStatus.QA_PENDING,
        remarks=data.get("remarks"),
        created_by=created_by.id,
    )
    db.add(fg_batch)
    await db.flush()

    # Generate QR code
    qr_path = generate_fg_qr(fg_batch.id, fg_batch.batch_number)
    fg_batch.qr_code_path = qr_path

    # Generate shipper label
    label_data = {
        "fg_batch_id": fg_batch.id,
        "product_name": fg_batch.product_name,
        "batch_number": fg_batch.batch_number,
        "manufacture_date": str(fg_batch.manufacture_date),
        "expiry_date": str(fg_batch.expiry_date),
        "net_weight": str(fg_batch.net_weight or ""),
        "gross_weight": str(fg_batch.gross_weight or ""),
        "quantity": str(fg_batch.quantity),
        "carton_number": str(fg_batch.carton_count or ""),
        "qr_path": qr_path,
    }
    shipper_path = generate_shipper_label(label_data)
    fg_batch.shipper_label_path = shipper_path

    await log_action(
        db, "CREATE_FG_BATCH", created_by.id, created_by.username,
        "fg_batch", fg_batch.id,
        f"FG batch {fg_batch.batch_number} created ({fg_batch.quantity} units)",
        from_status=None,
        to_status=audit_status_value(fg_batch.status),
    )
    await db.commit()
    await db.refresh(fg_batch)
    return fg_batch


async def get_fg_batch_by_id(db: AsyncSession, fg_batch_id: int) -> FinishedGoodsBatch:
    batch = await db.get(FinishedGoodsBatch, fg_batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="FG batch not found")
    return batch


async def list_fg_batches(db: AsyncSession, status: str | None = None) -> list:
    query = select(FinishedGoodsBatch).order_by(FinishedGoodsBatch.created_at.desc())
    if status:
        query = query.where(FinishedGoodsBatch.status == status)
    result = await db.execute(query)
    return result.scalars().all()
