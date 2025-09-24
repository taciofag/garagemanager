from __future__ import annotations

from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.vendor import VendorType
from ..repositories.vendor import VendorRepository
from ..schemas.common import PaginationParams
from ..schemas.vendor import VendorCreate, VendorRead, VendorUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("", response_model=dict)
async def list_vendors(
    pagination: PaginationParams = Depends(get_pagination_params),
    type: Optional[VendorType] = Query(default=None),
    name: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = VendorRepository(session)
    result = await repo.list_vendors(pagination, type=type, name=name)
    items = [VendorRead.model_validate(vendor) for vendor in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=VendorRead, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VendorRead:
    repo = VendorRepository(session)
    vendor = await repo.create_vendor(payload.model_dump(exclude_none=True))
    await session.commit()
    return VendorRead.model_validate(vendor)


@router.get("/{vendor_id}", response_model=VendorRead)
async def get_vendor(
    vendor_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> VendorRead:
    repo = VendorRepository(session)
    vendor = await repo.get(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await session.commit()
    return VendorRead.model_validate(vendor)


@router.patch("/{vendor_id}", response_model=VendorRead)
async def update_vendor(
    vendor_id: str,
    payload: VendorUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VendorRead:
    repo = VendorRepository(session)
    vendor = await repo.get(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    updated = await repo.update_vendor(vendor, payload.model_dump(exclude_none=True))
    await session.commit()
    return VendorRead.model_validate(updated)


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = VendorRepository(session)
    vendor = await repo.get(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await repo.delete(vendor)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

