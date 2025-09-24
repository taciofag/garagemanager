from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.vehicle import VehicleStatus
from ..repositories.vehicle import VehicleRepository
from ..schemas.common import PaginatedResult, PaginationParams
from ..schemas.vehicle import VehicleCreate, VehicleRead, VehicleSell, VehicleUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def serialize_vehicle(vehicle) -> VehicleRead:
    vehicle.sync_status()
    return VehicleRead.model_validate(vehicle)


@router.get("", response_model=dict)
async def list_vehicles(
    pagination: PaginationParams = Depends(get_pagination_params),
    status: Optional[VehicleStatus] = Query(default=None),
    make: Optional[str] = Query(default=None),
    model: Optional[str] = Query(default=None),
    year_from: Optional[int] = Query(default=None),
    year_to: Optional[int] = Query(default=None),
    in_stock: Optional[bool] = Query(default=None),
    rented: Optional[bool] = Query(default=None),
    sold: Optional[bool] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = VehicleRepository(session)
    result: PaginatedResult = await repo.list_vehicles(
        pagination,
        status=status,
        make=make,
        model=model,
        year_from=year_from,
        year_to=year_to,
        in_stock=in_stock,
        rented=rented,
        sold=sold,
    )
    items = [serialize_vehicle(vehicle) for vehicle in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    payload: VehicleCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleRead:
    repo = VehicleRepository(session)
    try:
        vehicle = await repo.create_vehicle(payload.model_dump(exclude_none=True))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Placa, Renavam e chassi devem ser únicos.") from exc
    return serialize_vehicle(vehicle)


@router.get("/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(
    vehicle_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> VehicleRead:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await session.commit()
    return serialize_vehicle(vehicle)


@router.patch("/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(
    vehicle_id: str,
    payload: VehicleUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleRead:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        updated = await repo.update_vehicle(vehicle, payload.model_dump(exclude_none=True))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Placa, Renavam e chassi devem ser únicos.") from exc
    return serialize_vehicle(updated)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await repo.delete(vehicle)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{vehicle_id}/sell", response_model=VehicleRead)
async def sell_vehicle(
    vehicle_id: str,
    payload: VehicleSell,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleRead:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    updated = await repo.sell_vehicle(vehicle, payload)
    await session.commit()
    return serialize_vehicle(updated)

