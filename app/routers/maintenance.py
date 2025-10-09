from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.maintenance import MaintenanceOccurrenceStatus
from ..schemas.common import PaginationParams
from ..schemas.maintenance import (
    MaintenanceOccurrenceActionRequest,
    MaintenanceOccurrenceActionResponse,
    MaintenanceOccurrencesResponse,
    MaintenanceSeriesCreate,
    MaintenanceSeriesRead,
    MaintenanceSeriesUpdate,
)
from ..services.maintenance import MaintenanceService
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _service(session: AsyncSession) -> MaintenanceService:
    return MaintenanceService(session)


@router.post("/series", response_model=MaintenanceSeriesRead, status_code=status.HTTP_201_CREATED)
async def create_maintenance_series(
    payload: MaintenanceSeriesCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> MaintenanceSeriesRead:
    service = _service(session)
    series = await service.create_series(payload.model_dump(exclude_none=True))
    await session.commit()
    await session.refresh(series, attribute_names=["vehicle", "supplier"])
    return MaintenanceSeriesRead.model_validate(series)


@router.patch("/series/{series_id}", response_model=MaintenanceSeriesRead)
async def update_maintenance_series(
    series_id: int,
    payload: MaintenanceSeriesUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> MaintenanceSeriesRead:
    service = _service(session)
    try:
        series = await service.update_series(series_id, payload.model_dump(exclude_none=True))
    except ValueError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await session.commit()
    await session.refresh(series, attribute_names=["vehicle", "supplier"])
    return MaintenanceSeriesRead.model_validate(series)


@router.post("/series/{series_id}/regenerate", response_model=dict)
async def regenerate_maintenance_series(
    series_id: int,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> dict:
    service = _service(session)
    try:
        series, created = await service.regenerate_series(series_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await session.commit()
    await session.refresh(series, attribute_names=["vehicle", "supplier"])
    return {
        "series": MaintenanceSeriesRead.model_validate(series),
        "created": created,
    }


@router.get("/occurrences", response_model=MaintenanceOccurrencesResponse)
async def list_maintenance_occurrences(
    scope: str = Query("upcoming", pattern="^(upcoming|overdue|history)$"),
    days: int = Query(30, ge=1, le=365),
    vehicle_id: Optional[str] = Query(default=None),
    supplier_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    status_filter: Optional[MaintenanceOccurrenceStatus] = Query(default=None, alias="status"),
    pagination: PaginationParams = Depends(get_pagination_params),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> MaintenanceOccurrencesResponse:
    service = _service(session)
    try:
        result = await service.list_occurrences(
            pagination,
            scope=scope,
            days=days,
            vehicle_id=vehicle_id,
            supplier_id=supplier_id,
            category=category,
            status=status_filter,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await session.commit()
    return result


@router.post("/occurrences/{occurrence_id}/pay", response_model=MaintenanceOccurrenceActionResponse)
async def pay_maintenance_occurrence(
    occurrence_id: int,
    payload: MaintenanceOccurrenceActionRequest | None = None,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> MaintenanceOccurrenceActionResponse:
    service = _service(session)
    try:
        payload_data = payload or MaintenanceOccurrenceActionRequest()
        result = await service.pay_occurrence(
            occurrence_id,
            paid_at=payload_data.paid_at,
            note=payload_data.note,
            cash_category_id=payload_data.cash_category_id,
            payment_method=payload_data.payment_method,
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "Occurrence not found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    await session.commit()
    return result


@router.post("/occurrences/{occurrence_id}/ignore", response_model=MaintenanceOccurrenceActionResponse)
async def ignore_maintenance_occurrence(
    occurrence_id: int,
    note: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> MaintenanceOccurrenceActionResponse:
    service = _service(session)
    try:
        result = await service.ignore_occurrence(occurrence_id, note=note)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await session.commit()
    return result


@router.post("/occurrences/{occurrence_id}/reopen", response_model=MaintenanceOccurrenceActionResponse)
async def reopen_maintenance_occurrence(
    occurrence_id: int,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> MaintenanceOccurrenceActionResponse:
    service = _service(session)
    try:
        result = await service.reopen_occurrence(occurrence_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await session.commit()
    return result
