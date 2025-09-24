from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from ..models.rent_payment import RentPayment
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class RentPaymentRepository(BaseRepository[RentPayment]):
    model = RentPayment

    async def list_payments(
        self,
        params: PaginationParams,
        rental_id: Optional[str] = None,
        open_only: bool = False,
    ) -> PaginatedResult[RentPayment]:
        filters = []
        if rental_id:
            filters.append(RentPayment.rental_id == rental_id)
        if open_only:
            filters.append(RentPayment.paid_amount < RentPayment.due_amount + RentPayment.late_fee)
        return await super().list(
            params,
            filters=filters,
            options=[selectinload(RentPayment.rental)],
        )

    async def create_payment(self, data: dict) -> RentPayment:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("PAY")
        payload.setdefault("weeks", 1)
        payload.setdefault("due_amount", Decimal("0"))
        payload.setdefault("paid_amount", Decimal("0"))
        payload.setdefault("late_fee", Decimal("0"))
        payment = RentPayment(**payload)
        payment.recompute_totals()
        await self.create(payment)
        return payment

    async def update_payment(self, payment: RentPayment, data: dict) -> RentPayment:
        for key, value in data.items():
            if value is not None and hasattr(payment, key):
                setattr(payment, key, value)
        payment.recompute_totals()
        await self.session.flush()
        return payment

    async def exists_for_period(self, rental_id: str, period_start: date, period_end: date) -> bool:
        stmt = select(RentPayment.id).where(
            and_(
                RentPayment.rental_id == rental_id,
                RentPayment.period_start == period_start,
                RentPayment.period_end == period_end,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

