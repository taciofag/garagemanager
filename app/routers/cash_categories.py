from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models.user import User
from ..repositories.cash_category import CashCategoryRepository
from ..schemas.cash_category import CashCategoryCreate, CashCategoryRead, CashCategoryUpdate
from ..services.security import get_current_active_user, get_current_admin
from ..utils.text import slugify

router = APIRouter(prefix="/cash-categories", tags=["cash-categories"])


@router.get("", response_model=list[CashCategoryRead])
async def list_cash_categories(
    include_inactive: bool = Query(default=False),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[CashCategoryRead]:
    repo = CashCategoryRepository(session)
    if include_inactive and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    categories = await repo.list_all(include_inactive=include_inactive)
    await session.commit()
    return [CashCategoryRead.model_validate(category) for category in categories]


@router.post("", response_model=CashCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_cash_category(
    payload: CashCategoryCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> CashCategoryRead:
    repo = CashCategoryRepository(session)
    slug = slugify(payload.name)
    existing = await repo.get_by_slug(slug)
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")
    category = await repo.create_category(
        {
            "id": await repo.generate_id("CAT"),
            "name": payload.name,
            "slug": slug,
            "description": payload.description,
            "is_active": payload.is_active,
            "is_system": False,
        }
    )
    await session.commit()
    return CashCategoryRead.model_validate(category)


@router.patch("/{category_id}", response_model=CashCategoryRead)
async def update_cash_category(
    category_id: str,
    payload: CashCategoryUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> CashCategoryRead:
    repo = CashCategoryRepository(session)
    category = await repo.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    update_data = payload.model_dump(exclude_none=True)
    if "name" in update_data:
        new_slug = slugify(update_data["name"])
        existing = await repo.get_by_slug(new_slug)
        if existing and existing.id != category.id:
            raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")
        update_data["slug"] = new_slug
    if category.is_system and "is_active" in update_data and not update_data["is_active"]:
        raise HTTPException(status_code=400, detail="Categorias do sistema não podem ser desativadas")
    updated = await repo.update_category(category, update_data)
    await session.commit()
    return CashCategoryRead.model_validate(updated)
