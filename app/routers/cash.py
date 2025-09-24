from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.cash import CashTxnType
from ..repositories.cash import CashRepository
from ..schemas.cash import CashTxnCreate, CashTxnRead, CashTxnUpdate
from ..schemas.common import PaginationParams
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/cash", tags=["cash"])


@router.get("", response_model=dict)
async def list_cash_txns(
    pagination: PaginationParams = Depends(get_pagination_params),
    type: Optional[CashTxnType] = Query(default=None),
    category: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = CashRepository(session)
    result = await repo.list_txns(
        pagination,
        type=type,
        category=category,
        start_date=start_date,
        end_date=end_date,
    )
    items = [CashTxnRead.model_validate(txn) for txn in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=CashTxnRead, status_code=status.HTTP_201_CREATED)
async def create_cash_txn(
    payload: CashTxnCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> CashTxnRead:
    repo = CashRepository(session)
    txn = await repo.create_txn(payload.model_dump(exclude_none=True))
    await session.commit()
    return CashTxnRead.model_validate(txn)


@router.get("/{txn_id}", response_model=CashTxnRead)
async def get_cash_txn(
    txn_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> CashTxnRead:
    repo = CashRepository(session)
    txn = await repo.get(txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Cash transaction not found")
    await session.commit()
    return CashTxnRead.model_validate(txn)


@router.patch("/{txn_id}", response_model=CashTxnRead)
async def update_cash_txn(
    txn_id: str,
    payload: CashTxnUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> CashTxnRead:
    repo = CashRepository(session)
    txn = await repo.get(txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Cash transaction not found")
    updated = await repo.update_txn(txn, payload.model_dump(exclude_none=True))
    await session.commit()
    return CashTxnRead.model_validate(updated)


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cash_txn(
    txn_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = CashRepository(session)
    txn = await repo.get(txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Cash transaction not found")
    await repo.delete(txn)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

