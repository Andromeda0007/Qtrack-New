from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_permission, get_current_user
from app.models.user_models import User
from app.models.finished_goods_models import FGStatus
from app.production import service
from app.production.schemas import FGBatchCreate

router = APIRouter()


@router.post("/fg-batch")
async def create_fg_batch(
    payload: FGBatchCreate,
    current_user: User = Depends(require_permission("CREATE_FG_BATCH")),
    db: AsyncSession = Depends(get_db),
):
    fg = await service.create_fg_batch(db, payload.model_dump(), current_user)
    return {
        "message": "FG batch created successfully",
        "fg_batch_id": fg.id,
        "batch_number": fg.batch_number,
        "status": fg.status,
        "qr_code_path": fg.qr_code_path,
        "shipper_label_path": fg.shipper_label_path,
    }


@router.get("/fg-batch")
async def list_fg_batches(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # QA roles only work on FG awaiting inspection (not warehouse / production wide lists)
    rname = current_user.role.role_name if current_user.role else ""
    if rname in ("QA_EXECUTIVE", "QA_HEAD"):
        status = "QA_PENDING"
    batches = await service.list_fg_batches(db, status)
    return [
        {
            "id": b.id,
            "product_name": b.product_name,
            "batch_number": b.batch_number,
            "manufacture_date": b.manufacture_date,
            "expiry_date": b.expiry_date,
            "quantity": b.quantity,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in batches
    ]


@router.get("/fg-batch/{fg_batch_id}")
async def get_fg_batch(
    fg_batch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fg = await service.get_fg_batch_by_id(db, fg_batch_id)
    rname = current_user.role.role_name if current_user.role else ""
    if rname in ("QA_EXECUTIVE", "QA_HEAD"):
        st = fg.status.value if hasattr(fg.status, "value") else str(fg.status)
        if st != FGStatus.QA_PENDING.value:
            raise HTTPException(
                status_code=403,
                detail="QA can only open finished goods that are pending QA inspection.",
            )
    return {
        "id": fg.id,
        "product_name": fg.product_name,
        "batch_number": fg.batch_number,
        "manufacture_date": fg.manufacture_date,
        "expiry_date": fg.expiry_date,
        "net_weight": fg.net_weight,
        "gross_weight": fg.gross_weight,
        "quantity": fg.quantity,
        "carton_count": fg.carton_count,
        "status": fg.status,
        "qr_code_path": fg.qr_code_path,
        "shipper_label_path": fg.shipper_label_path,
        "remarks": fg.remarks,
    }


@router.get("/fg-batch/{fg_batch_id}/shipper-label")
async def download_shipper_label(
    fg_batch_id: int,
    current_user: User = Depends(require_permission("GENERATE_SHIPPER_LABEL")),
    db: AsyncSession = Depends(get_db),
):
    fg = await service.get_fg_batch_by_id(db, fg_batch_id)
    if not fg.shipper_label_path:
        from app.utils.pdf_generator import generate_shipper_label
        label_data = {
            "fg_batch_id": fg.id,
            "product_name": fg.product_name,
            "batch_number": fg.batch_number,
            "manufacture_date": str(fg.manufacture_date),
            "expiry_date": str(fg.expiry_date),
            "net_weight": str(fg.net_weight or ""),
            "gross_weight": str(fg.gross_weight or ""),
            "quantity": str(fg.quantity),
            "carton_number": str(fg.carton_count or ""),
            "qr_path": fg.qr_code_path or "",
        }
        path = generate_shipper_label(label_data)
        fg.shipper_label_path = path
        await db.commit()
    return FileResponse(fg.shipper_label_path, media_type="application/pdf", filename=f"shipper_{fg.batch_number}.pdf")
