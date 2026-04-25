"""Item (Material) master — managed by Warehouse Head.

Warehouse Head supplies item name, item code, and optional description.
Soft delete via ``is_active = False``.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.inventory_models import Material, Batch, BatchStatus
from app.models.user_models import User
from app.materials.schemas import (
    MaterialCreate, MaterialUpdate, MaterialResponse, MaterialBatchCounts,
)
from app.audit.service import log_action

router = APIRouter()


@router.post("/", response_model=MaterialResponse)
async def create_material(
    payload: MaterialCreate,
    current_user: User = Depends(require_permission("MANAGE_ITEMS")),
    db: AsyncSession = Depends(get_db),
):
    # Reject duplicate ACTIVE name (case-insensitive)
    existing = await db.execute(
        select(Material).where(
            func.lower(Material.material_name) == payload.material_name.strip().lower(),
            Material.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An active item with this name already exists")

    # Reject duplicate code (any status — codes must be globally unique)
    code_check = await db.execute(
        select(Material.id).where(
            func.upper(Material.material_code) == payload.material_code.strip().upper()
        )
    )
    if code_check.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Item code '{payload.material_code.strip()}' is already in use")

    code = payload.material_code.strip().upper()

    material = Material(
        material_name=payload.material_name.strip(),
        material_code=code,
        description=payload.description,
        unit_of_measure="KG",
        is_active=True,
        created_by=current_user.id,
    )
    db.add(material)
    await db.flush()
    await log_action(
        db, "CREATE_ITEM", current_user.id, current_user.username, "material", material.id,
        f"Created item {code} '{material.material_name}'",
    )
    await db.commit()
    await db.refresh(material)
    return material


@router.get("/", response_model=list[MaterialResponse])
async def list_materials(
    include_inactive: bool = Query(False, description="Include deactivated items (Head only)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Material).order_by(func.lower(Material.material_name))
    if not include_inactive:
        query = query.where(Material.is_active == True)  # noqa: E712
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Item not found")
    return material


@router.get("/{material_id}/batch-counts", response_model=MaterialBatchCounts)
async def get_material_batch_counts(
    material_id: int,
    current_user: User = Depends(require_permission("MANAGE_ITEMS")),
    db: AsyncSession = Depends(get_db),
):
    """Return counts of non-terminal batches — used by the mobile Deactivate warning."""
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Item not found")

    # Active = anything not REJECTED
    rows = await db.execute(
        select(Batch.status, func.count(Batch.id))
        .where(Batch.material_id == material_id)
        .where(Batch.status != BatchStatus.REJECTED)
        .group_by(Batch.status)
    )
    counts = {str(s): int(n) for s, n in rows.all()}
    q = int(counts.get(BatchStatus.QUARANTINE.value, 0))
    ut = int(counts.get(BatchStatus.UNDER_TEST.value, 0))
    ap = int(counts.get(BatchStatus.APPROVED.value, 0))
    qr = int(counts.get(BatchStatus.QUARANTINE_RETEST.value, 0))
    ip = int(counts.get(BatchStatus.ISSUED_TO_PRODUCTION.value, 0))
    return MaterialBatchCounts(
        quarantine=q,
        under_test=ut,
        approved=ap,
        quarantine_retest=qr,
        issued_to_production=ip,
        total_active=q + ut + ap + qr + ip,
    )


@router.patch("/{material_id}", response_model=MaterialResponse)
async def update_material(
    material_id: int,
    payload: MaterialUpdate,
    current_user: User = Depends(require_permission("MANAGE_ITEMS")),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Item not found")

    data = payload.model_dump(exclude_none=True)

    # If renaming, ensure uniqueness among active items (excluding self)
    if "material_name" in data:
        new_name = data["material_name"].strip()
        dup = await db.execute(
            select(Material.id).where(
                func.lower(Material.material_name) == new_name.lower(),
                Material.is_active == True,  # noqa: E712
                Material.id != material_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Another active item already uses this name")
        data["material_name"] = new_name

    was_active = material.is_active
    for key, value in data.items():
        setattr(material, key, value)

    action = "UPDATE_ITEM"
    if "is_active" in data and was_active and not material.is_active:
        action = "DEACTIVATE_ITEM"
    elif "is_active" in data and not was_active and material.is_active:
        action = "REACTIVATE_ITEM"

    await log_action(
        db, action, current_user.id, current_user.username,
        "material", material_id,
        f"{action} on {material.material_code}",
    )
    await db.commit()
    await db.refresh(material)
    return material
