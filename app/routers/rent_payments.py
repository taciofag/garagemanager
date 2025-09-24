from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..repositories.rent_payment import RentPaymentRepository
from ..repositories.rental import RentalRepository
from ..schemas.common import PaginationParams
from ..schemas.rent_payment import (
    RentPaymentCreate,
    RentPaymentGenerate,
    RentPaymentRead,
    RentPaymentUpdate,
)
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/rent-payments", tags=["rent-payments"])


@router.get("", response_model=dict)
async def list_rent_payments(
    pagination: PaginationParams = Depends(get_pagination_params),
    rental_id: Optional[str] = Query(default=None),
    open_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = RentPaymentRepository(session)
    result = await repo.list_payments(pagination, rental_id=rental_id, open_only=open_only)
    items = [RentPaymentRead.model_validate(payment) for payment in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=RentPaymentRead, status_code=status.HTTP_201_CREATED)
async def create_rent_payment(
    payload: RentPaymentCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> RentPaymentRead:
    repo = RentPaymentRepository(session)
    payment = await repo.create_payment(payload.model_dump(exclude_none=True))
    await session.commit()
    return RentPaymentRead.model_validate(payment)


@router.get("/{payment_id}", response_model=RentPaymentRead)
async def get_rent_payment(
    payment_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> RentPaymentRead:
    repo = RentPaymentRepository(session)
    payment = await repo.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Rent payment not found")
    await session.commit()
    return RentPaymentRead.model_validate(payment)


@router.patch("/{payment_id}", response_model=RentPaymentRead)
async def update_rent_payment(
    payment_id: str,
    payload: RentPaymentUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> RentPaymentRead:
    repo = RentPaymentRepository(session)
    payment = await repo.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Rent payment not found")
    updated = await repo.update_payment(payment, payload.model_dump(exclude_none=True))
    await session.commit()
    return RentPaymentRead.model_validate(updated)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rent_payment(
    payment_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = RentPaymentRepository(session)
    payment = await repo.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Rent payment not found")
    await repo.delete(payment)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/generate-weekly", response_model=RentPaymentRead, status_code=status.HTTP_201_CREATED)
async def generate_weekly_payment(
    payload: RentPaymentGenerate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> RentPaymentRead:
    repo = RentPaymentRepository(session)
    if await repo.exists_for_period(payload.rental_id, payload.period_start, payload.period_end):
        raise HTTPException(status_code=400, detail="Payment for period already exists")
    rental_repo = RentalRepository(session)
    rental = await rental_repo.get(payload.rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    payment = await repo.create_payment(
        {
            "rental_id": payload.rental_id,
            "period_start": payload.period_start,
            "period_end": payload.period_end,
            "weekly_rate": rental.weekly_rate,
            "paid_amount": 0,
            "late_fee": 0,
        }
    )
    await session.commit()
    return RentPaymentRead.model_validate(payment)

