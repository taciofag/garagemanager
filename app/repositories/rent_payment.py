from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional, Sequence, Tuple

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, or_, select

from ..models.rent_payment import RentPayment
from ..models.rental import BillingDay, Rental
from ..schemas.common import PaginatedResult, PaginationParams
from .base import BaseRepository


_BILLING_DAY_TO_WEEKDAY = {
    BillingDay.MON: 0,
    BillingDay.TUE: 1,
    BillingDay.WED: 2,
    BillingDay.THU: 3,
    BillingDay.FRI: 4,
    BillingDay.SAT: 5,
    BillingDay.SUN: 6,
}


def _next_due_date(anchor: date, target_weekday: int) -> date:
    """Return the next date *after* anchor that matches target_weekday."""
    days_ahead = (target_weekday - anchor.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return anchor + timedelta(days=days_ahead)


def _generate_periods(range_start: date, range_end: date, target_weekday: int) -> Sequence[Tuple[date, date]]:
    """Yield weekly billing periods covering the given range."""
    if range_start > range_end:
        return []

    periods: list[Tuple[date, date]] = []
    current_start = range_start
    due_date = _next_due_date(current_start, target_weekday)

    while current_start <= range_end:
        period_end = due_date - timedelta(days=1)
        if period_end < current_start:
            period_end = current_start
        if period_end > range_end:
            period_end = range_end
        periods.append((current_start, period_end))
        current_start = period_end + timedelta(days=1)
        if current_start > range_end:
            break
        due_date = _next_due_date(current_start, target_weekday)

    return periods


def _merge_intervals(intervals: Sequence[Tuple[date, date]]) -> List[Tuple[date, date]]:
    if not intervals:
        return []
    sorted_intervals = sorted(intervals, key=lambda item: item[0])
    merged: list[Tuple[date, date]] = []
    for start, end in sorted_intervals:
        if not merged:
            merged.append((start, end))
            continue
        last_start, last_end = merged[-1]
        if start <= last_end + timedelta(days=1):
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


class RentPaymentRepository(BaseRepository[RentPayment]):
    model = RentPayment

    @classmethod
    def default_order_attr(cls, params: PaginationParams):
        return RentPayment.period_start

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
            filters.append(
                or_(
                    RentPayment.payment_date.is_(None),
                    RentPayment.paid_amount < RentPayment.due_amount + RentPayment.late_fee,
                )
            )
        return await super().list(params, filters=filters)

    async def create_payment(self, data: dict) -> RentPayment:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("PAY")
        payment = RentPayment(**payload)
        payment.recompute_totals()
        await self.create(payment)
        await self.session.refresh(payment)
        return payment

    async def update_payment(self, payment: RentPayment, data: dict) -> RentPayment:
        for key, value in data.items():
            if value is not None and hasattr(payment, key):
                setattr(payment, key, value)
        payment.recompute_totals()
        await self.session.flush()
        await self.session.refresh(payment)
        return payment

    async def exists_for_period(self, rental_id: str, start: date, end: date) -> bool:
        stmt = (
            select(RentPayment.id)
            .where(
                and_(
                    RentPayment.rental_id == rental_id,
                    RentPayment.period_start <= end,
                    RentPayment.period_end >= start,
                )
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def ensure_schedule(
        self,
        rental: Rental,
        *,
        months: Optional[int] = None,
        until: Optional[date] = None,
        start_from: Optional[date] = None,
    ) -> list[RentPayment]:
        anchor_start = start_from or rental.start_date
        if anchor_start < rental.start_date:
            anchor_start = rental.start_date

        min_term_end = rental.start_date + relativedelta(months=rental.minimum_term_months) - timedelta(days=1)
        target_dates: list[date] = [min_term_end]

        if months:
            months_end = anchor_start + relativedelta(months=months) - timedelta(days=1)
            target_dates.append(months_end)
        if until:
            target_dates.append(until)

        schedule_end = max(target_dates)
        if schedule_end < anchor_start:
            schedule_end = anchor_start
        if rental.end_date:
            schedule_end = min(schedule_end, rental.end_date)

        if schedule_end < anchor_start:
            return []

        stmt = (
            select(RentPayment.period_start, RentPayment.period_end)
            .where(
                and_(
                    RentPayment.rental_id == rental.id,
                    RentPayment.period_end >= anchor_start,
                    RentPayment.period_start <= schedule_end,
                )
            )
            .order_by(RentPayment.period_start.asc())
        )
        existing_rows = (await self.session.execute(stmt)).all()
        existing_intervals = _merge_intervals(
            [
                (
                    max(row.period_start, anchor_start),
                    min(row.period_end, schedule_end),
                )
                for row in existing_rows
            ]
        )

        coverage_ranges: list[Tuple[date, date]] = []
        cursor = anchor_start
        for start, end in existing_intervals:
            if start > cursor:
                gap_end = min(start - timedelta(days=1), schedule_end)
                if cursor <= gap_end:
                    coverage_ranges.append((cursor, gap_end))
            cursor = max(cursor, end + timedelta(days=1))
            if cursor > schedule_end:
                break
        if cursor <= schedule_end:
            coverage_ranges.append((cursor, schedule_end))

        if not coverage_ranges:
            return []

        generated: list[RentPayment] = []
        weekday = _BILLING_DAY_TO_WEEKDAY[rental.billing_day]
        for range_start, range_end in coverage_ranges:
            for period_start, period_end in _generate_periods(range_start, range_end, weekday):
                if period_start > period_end:
                    continue
                if await self.exists_for_period(rental.id, period_start, period_end):
                    continue
                payment = await self.create_payment(
                    {
                        "rental_id": rental.id,
                        "period_start": period_start,
                        "period_end": period_end,
                        "weekly_rate": rental.weekly_rate,
                        "paid_amount": 0,
                        "late_fee": 0,
                    }
                )
                generated.append(payment)
        return generated


__all__ = ["RentPaymentRepository"]
