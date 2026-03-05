from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.inventory_models import Material
from app.models.user_models import User
from app.materials.schemas import MaterialCreate, MaterialUpdate, MaterialResponse
from app.audit.service import log_action

router = APIRouter()


@router.post("/", response_model=MaterialResponse)
async def create_material(
    payload: MaterialCreate,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Material).where(Material.material_code == payload.material_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Material code already exists")

    material = Material(**payload.model_dump())
    db.add(material)
    await db.flush()
    await log_action(db, "CREATE_MATERIAL", current_user.id, current_user.username, "material", material.id, f"Created material '{material.material_name}'")
    await db.commit()
    await db.refresh(material)
    return material


@router.get("/", response_model=list[MaterialResponse])
async def list_materials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Material).where(Material.is_active == True).order_by(Material.material_name))
    return result.scalars().all()


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.patch("/{material_id}", response_model=MaterialResponse)
async def update_material(
    material_id: int,
    payload: MaterialUpdate,
    current_user: User = Depends(require_permission("MANAGE_USERS")),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(material, key, value)

    await log_action(db, "UPDATE_MATERIAL", current_user.id, current_user.username, "material", material_id)
    await db.commit()
    await db.refresh(material)
    return material
