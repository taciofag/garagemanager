from __future__ import annotations

from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.driver import DriverStatus
from ..repositories.driver import DriverRepository
from ..schemas.driver import DriverCreate, DriverRead, DriverUpdate
from ..schemas.common import PaginationParams
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("", response_model=dict)
async def list_drivers(
    pagination: PaginationParams = Depends(get_pagination_params),
    status: Optional[DriverStatus] = Query(default=None),
    name: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = DriverRepository(session)
    result = await repo.list_drivers(pagination, status=status, name=name)
    items = [DriverRead.model_validate(driver) for driver in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
async def create_driver(
    payload: DriverCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> DriverRead:
    repo = DriverRepository(session)
    driver = await repo.create_driver(payload.model_dump(exclude_none=True))
    await session.commit()
    return DriverRead.model_validate(driver)


@router.get("/{driver_id}", response_model=DriverRead)
async def get_driver(
    driver_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> DriverRead:
    repo = DriverRepository(session)
    driver = await repo.get(driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    await session.commit()
    return DriverRead.model_validate(driver)


@router.patch("/{driver_id}", response_model=DriverRead)
async def update_driver(
    driver_id: str,
    payload: DriverUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> DriverRead:
    repo = DriverRepository(session)
    driver = await repo.get(driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    updated = await repo.update_driver(driver, payload.model_dump(exclude_none=True))
    await session.commit()
    return DriverRead.model_validate(updated)


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = DriverRepository(session)
    driver = await repo.get(driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    await repo.delete(driver)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

