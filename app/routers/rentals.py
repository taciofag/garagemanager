from __future__ import annotations

from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.rental import RentalStatus
from ..repositories.rental import RentalRepository
from ..schemas.common import PaginationParams
from ..schemas.rental import RentalClose, RentalCreate, RentalRead, RentalUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/rentals", tags=["rentals"])


@router.get("", response_model=dict)
async def list_rentals(
    pagination: PaginationParams = Depends(get_pagination_params),
    status: Optional[RentalStatus] = Query(default=None),
    driver_id: Optional[str] = Query(default=None),
    vehicle_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = RentalRepository(session)
    result = await repo.list_rentals(
        pagination,
        status=status,
        driver_id=driver_id,
        vehicle_id=vehicle_id,
    )
    items = [RentalRead.model_validate(rental) for rental in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=RentalRead, status_code=status.HTTP_201_CREATED)
async def create_rental(
    payload: RentalCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> RentalRead:
    repo = RentalRepository(session)
    rental = await repo.create_rental(payload.model_dump(exclude_none=True))
    await session.commit()
    return RentalRead.model_validate(rental)


@router.get("/{rental_id}", response_model=RentalRead)
async def get_rental(
    rental_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> RentalRead:
    repo = RentalRepository(session)
    rental = await repo.get(rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    await session.commit()
    return RentalRead.model_validate(rental)


@router.patch("/{rental_id}", response_model=RentalRead)
async def update_rental(
    rental_id: str,
    payload: RentalUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> RentalRead:
    repo = RentalRepository(session)
    rental = await repo.get(rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    updated = await repo.update_rental(rental, payload.model_dump(exclude_none=True))
    await session.commit()
    return RentalRead.model_validate(updated)


@router.post("/{rental_id}/close", response_model=RentalRead)
async def close_rental(
    rental_id: str,
    payload: RentalClose,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> RentalRead:
    repo = RentalRepository(session)
    rental = await repo.get(rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    updated = await repo.close_rental(rental, payload)
    await session.commit()
    return RentalRead.model_validate(updated)


@router.delete("/{rental_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rental(
    rental_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = RentalRepository(session)
    rental = await repo.get(rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    await repo.delete_rental(rental)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

