from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..repositories.partner import PartnerRepository
from ..schemas.common import PaginationParams
from ..schemas.partner import PartnerCreate, PartnerRead, PartnerUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix='/partners', tags=['partners'])


@router.get('', response_model=dict)
async def list_partners(
    pagination: PaginationParams = Depends(get_pagination_params),
    name: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = PartnerRepository(session)
    result = await repo.list_partners(pagination, name=name)
    items = [PartnerRead.model_validate(item) for item in result.items]
    await session.commit()
    return {
        'total': result.total,
        'page': result.page,
        'page_size': result.page_size,
        'items': items,
    }


@router.post('', response_model=PartnerRead, status_code=status.HTTP_201_CREATED)
async def create_partner(
    payload: PartnerCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> PartnerRead:
    repo = PartnerRepository(session)
    partner = await repo.create_partner(payload.model_dump(exclude_none=True))
    await session.commit()
    return PartnerRead.model_validate(partner)


@router.get('/{partner_id}', response_model=PartnerRead)
async def get_partner(
    partner_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> PartnerRead:
    repo = PartnerRepository(session)
    partner = await repo.get(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail='Partner not found')
    await session.commit()
    return PartnerRead.model_validate(partner)


@router.patch('/{partner_id}', response_model=PartnerRead)
async def update_partner(
    partner_id: str,
    payload: PartnerUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> PartnerRead:
    repo = PartnerRepository(session)
    partner = await repo.get(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail='Partner not found')
    updated = await repo.update_partner(partner, payload.model_dump(exclude_none=True))
    await session.commit()
    return PartnerRead.model_validate(updated)


@router.delete('/{partner_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_partner(
    partner_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = PartnerRepository(session)
    partner = await repo.get(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail='Partner not found')
    await repo.delete(partner)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
