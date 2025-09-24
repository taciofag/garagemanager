from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.capital import CapitalType
from ..repositories.capital import CapitalRepository
from ..schemas.capital import CapitalCreate, CapitalRead, CapitalUpdate
from ..schemas.common import PaginationParams
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/capital", tags=["capital"])


@router.get("", response_model=dict)
async def list_capital_entries(
    pagination: PaginationParams = Depends(get_pagination_params),
    partner: Optional[str] = Query(default=None),
    type: Optional[CapitalType] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = CapitalRepository(session)
    result = await repo.list_capital(
        pagination,
        partner=partner,
        type=type,
        start_date=start_date,
        end_date=end_date,
    )
    items = [CapitalRead.model_validate(entry) for entry in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=CapitalRead, status_code=status.HTTP_201_CREATED)
async def create_capital_entry(
    payload: CapitalCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> CapitalRead:
    repo = CapitalRepository(session)
    entry = await repo.create_capital(payload.model_dump(exclude_none=True))
    await session.commit()
    return CapitalRead.model_validate(entry)


@router.get("/{entry_id}", response_model=CapitalRead)
async def get_capital_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> CapitalRead:
    repo = CapitalRepository(session)
    entry = await repo.get(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Capital entry not found")
    await session.commit()
    return CapitalRead.model_validate(entry)


@router.patch("/{entry_id}", response_model=CapitalRead)
async def update_capital_entry(
    entry_id: str,
    payload: CapitalUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> CapitalRead:
    repo = CapitalRepository(session)
    entry = await repo.get(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Capital entry not found")
    updated = await repo.update_capital(entry, payload.model_dump(exclude_none=True))
    await session.commit()
    return CapitalRead.model_validate(updated)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_capital_entry(
    entry_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = CapitalRepository(session)
    entry = await repo.get(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Capital entry not found")
    await repo.delete(entry)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

