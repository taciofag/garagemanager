from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.maintenance import MaintenanceCategory, MaintenanceStatus
from ..repositories.maintenance import VehicleMaintenanceRepository
from ..schemas.common import PaginationParams
from ..schemas.maintenance import VehicleMaintenanceCreate, VehicleMaintenanceRead, VehicleMaintenanceUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=dict)
async def list_maintenance_tasks(
    pagination: PaginationParams = Depends(get_pagination_params),
    status_filter: Optional[MaintenanceStatus] = Query(default=None, alias="status"),
    vehicle_id: Optional[str] = Query(default=None),
    category: Optional[MaintenanceCategory] = Query(default=None),
    upcoming_until: Optional[date] = Query(default=None),
    vendor_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = VehicleMaintenanceRepository(session)
    result = await repo.list_tasks(
        pagination,
        status=status_filter,
        vehicle_id=vehicle_id,
        category=category,
        upcoming_until=upcoming_until,
        vendor_id=vendor_id,
    )
    items = [VehicleMaintenanceRead.model_validate(task) for task in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=VehicleMaintenanceRead, status_code=status.HTTP_201_CREATED)
async def create_maintenance_task(
    payload: VehicleMaintenanceCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleMaintenanceRead:
    repo = VehicleMaintenanceRepository(session)
    task = await repo.create_task(payload.model_dump(exclude_none=True))
    await session.commit()
    return VehicleMaintenanceRead.model_validate(task)


@router.get("/{task_id}", response_model=VehicleMaintenanceRead)
async def get_maintenance_task(
    task_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> VehicleMaintenanceRead:
    repo = VehicleMaintenanceRepository(session)
    task = await repo.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    await session.refresh(task, attribute_names=["vendor"])
    await session.commit()
    return VehicleMaintenanceRead.model_validate(task)


@router.patch("/{task_id}", response_model=VehicleMaintenanceRead)
async def update_maintenance_task(
    task_id: str,
    payload: VehicleMaintenanceUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleMaintenanceRead:
    repo = VehicleMaintenanceRepository(session)
    task = await repo.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    updated = await repo.update_task(task, payload.model_dump(exclude_none=True))
    await session.commit()
    return VehicleMaintenanceRead.model_validate(updated)


@router.post("/{task_id}/complete", response_model=VehicleMaintenanceRead)
async def complete_maintenance_task(
    task_id: str,
    completed_at: Optional[date] = Query(default=None),
    status_override: Optional[MaintenanceStatus] = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleMaintenanceRead:
    repo = VehicleMaintenanceRepository(session)
    task = await repo.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    target_status = status_override or MaintenanceStatus.COMPLETED
    updated = await repo.complete_task(task, completed_at=completed_at, status=target_status)
    await session.commit()
    return VehicleMaintenanceRead.model_validate(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_maintenance_task(
    task_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = VehicleMaintenanceRepository(session)
    task = await repo.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    await repo.delete_task(task)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
