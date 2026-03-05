from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.inventory_models import Supplier
from app.models.user_models import User
from app.suppliers.schemas import SupplierCreate, SupplierUpdate, SupplierResponse
from app.audit.service import log_action

router = APIRouter()


@router.post("/", response_model=SupplierResponse)
async def create_supplier(
    payload: SupplierCreate,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    await db.flush()
    await log_action(db, "CREATE_SUPPLIER", current_user.id, current_user.username, "supplier", supplier.id)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/", response_model=list[SupplierResponse])
async def list_suppliers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.is_active == True).order_by(Supplier.supplier_name))
    return result.scalars().all()


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(supplier, key, value)

    await log_action(db, "UPDATE_SUPPLIER", current_user.id, current_user.username, "supplier", supplier_id)
    await db.commit()
    await db.refresh(supplier)
    return supplier
