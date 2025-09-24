from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.rental import BillingDay, Rental, RentalStatus
from ..repositories.rent_payment import RentPaymentRepository
from ..repositories.rental import RentalRepository


DAY_MAP = {
    0: BillingDay.MON,
    1: BillingDay.TUE,
    2: BillingDay.WED,
    3: BillingDay.THU,
    4: BillingDay.FRI,
    5: BillingDay.SAT,
    6: BillingDay.SUN,
}


async def generate_weekly_charges(session: AsyncSession, today: date | None = None) -> Sequence[str]:
    today = today or date.today()
    repo = RentalRepository(session)
    payment_repo = RentPaymentRepository(session)

    target_day = DAY_MAP[today.weekday()]

    stmt = (
        select(Rental)
        .options(selectinload(Rental.payments))
        .where(Rental.status == RentalStatus.ACTIVE)
    )
    rentals = (await session.execute(stmt)).scalars().all()
    created_ids: list[str] = []

    for rental in rentals:
        if rental.billing_day != target_day:
            continue
        period_end = today - timedelta(days=1)
        period_start = period_end - timedelta(days=6)

        if rental.start_date > period_end:
            continue

        effective_start = max(rental.start_date, period_start)
        effective_end = period_end
        if rental.end_date and rental.end_date < effective_end:
            effective_end = rental.end_date
        if effective_start > effective_end:
            continue
        if await payment_repo.exists_for_period(rental.id, effective_start, effective_end):
            continue
        payload = {
            "rental_id": rental.id,
            "period_start": effective_start,
            "period_end": effective_end,
            "weekly_rate": rental.weekly_rate,
            "paid_amount": 0,
            "late_fee": 0,
        }
        payment = await payment_repo.create_payment(payload)
        created_ids.append(payment.id)

    return created_ids

