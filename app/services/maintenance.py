from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.cash import CashTxnType
from ..models.maintenance import (
    MaintenanceFrequency,
    MaintenanceOccurrence,
    MaintenanceOccurrenceStatus,
    MaintenanceSeries,
    MaintenanceSeriesStatus,
)
from ..models.vehicle import Vehicle
from ..models.vendor import Vendor
from ..repositories.maintenance import (
    MaintenanceOccurrenceRepository,
    MaintenanceSeriesRepository,
)
from ..repositories.cash import CashRepository
from ..schemas.common import PaginationParams
from ..schemas.maintenance import (
    MaintenanceOccurrenceActionResponse,
    MaintenanceOccurrenceRead,
    MaintenanceOccurrencesResponse,
    MaintenanceSummary,
)


class MaintenanceService:
    HORIZON_DAYS = 90

    def __init__(self, session: AsyncSession):
        self.session = session
        self.series_repo = MaintenanceSeriesRepository(session)
        self.occurrence_repo = MaintenanceOccurrenceRepository(session)

    @staticmethod
    def desired_horizon(frequency: MaintenanceFrequency, *, today: Optional[date] = None) -> date:
        base = today or date.today()
        base_horizon = base + timedelta(days=MaintenanceService.HORIZON_DAYS)
        if frequency == MaintenanceFrequency.MONTHLY:
            freq_horizon = base + relativedelta(months=3)
        elif frequency == MaintenanceFrequency.YEARLY:
            freq_horizon = base + relativedelta(years=3)
        elif frequency == MaintenanceFrequency.WEEKLY:
            freq_horizon = base + timedelta(weeks=3)
        else:
            freq_horizon = base_horizon
        return max(base_horizon, freq_horizon)

    async def create_series(self, data: dict[str, Any]) -> MaintenanceSeries:
        series = await self.series_repo.create_series(data)
        horizon = self.desired_horizon(series.frequency)
        await self.ensure_occurrences(series.id, horizon)
        await self.session.flush()
        await self.session.refresh(series, attribute_names=["vehicle", "supplier"])
        return series

    async def update_series(self, series_id: int, data: dict[str, Any]) -> MaintenanceSeries:
        series = await self.series_repo.get(series_id)
        if not series:
            raise ValueError("Series not found")
        series = await self.series_repo.update_series(series, data)
        horizon = self.desired_horizon(series.frequency)
        await self.ensure_occurrences(series.id, horizon)
        return series

    async def regenerate_series(self, series_id: int) -> tuple[MaintenanceSeries, int]:
        series = await self.series_repo.get(series_id)
        if not series:
            raise ValueError("Series not found")
        horizon = self.desired_horizon(series.frequency)
        created = await self.ensure_occurrences(series.id, horizon)
        return series, created

    async def ensure_occurrences(self, series_id: int, horizon_date: date) -> int:
        series = await self.series_repo.get(series_id)
        if not series:
            return 0
        if series.status != MaintenanceSeriesStatus.ACTIVE or series.frequency == MaintenanceFrequency.ON_DEMAND:
            await self._refresh_series_cache(series)
            return 0

        cutoff = horizon_date
        if series.end_date and series.end_date < cutoff:
            cutoff = series.end_date
        if cutoff < series.start_date:
            await self._refresh_series_cache(series)
            return 0

        existing_rows = (
            await self.session.execute(
                select(MaintenanceOccurrence.due_date).where(MaintenanceOccurrence.series_id == series.id)
            )
        ).all()
        existing_dates = {row.due_date for row in existing_rows}
        created = 0

        def add_occurrence(target_date: date) -> None:
            nonlocal created
            occurrence = MaintenanceOccurrence(
                series_id=series.id,
                due_date=target_date,
                amount=series.normalized_amount(),
                status=MaintenanceOccurrenceStatus.OPEN,
            )
            self.session.add(occurrence)
            created += 1

        if series.start_date <= cutoff and series.start_date not in existing_dates:
            add_occurrence(series.start_date)
            existing_dates.add(series.start_date)

        current = max(existing_dates) if existing_dates else None
        base_day = self._base_day(series)
        base_month = series.start_date.month

        while current:
            next_due = self._next_due_date(current, series.frequency, base_day, base_month)
            if not next_due:
                break
            if next_due > cutoff:
                break
            if series.end_date and next_due > series.end_date:
                break
            if next_due not in existing_dates:
                add_occurrence(next_due)
                existing_dates.add(next_due)
            current = next_due

        await self.session.flush()
        await self._refresh_series_cache(series)
        return created

    async def ensure_for_filters(
        self,
        *,
        vehicle_id: Optional[str] = None,
        supplier_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> None:
        series_list = await self.series_repo.list_for_horizon(
            vehicle_id=vehicle_id,
            supplier_id=supplier_id,
            category=category,
        )
        for series in series_list:
            if series.frequency == MaintenanceFrequency.ON_DEMAND:
                await self._refresh_series_cache(series)
                continue
            horizon = self.desired_horizon(series.frequency)
            if series.next_due_date is None or series.next_due_date <= horizon:
                await self.ensure_occurrences(series.id, horizon)
            else:
                await self._refresh_series_cache(series)

    async def list_occurrences(
        self,
        params: PaginationParams,
        *,
        scope: str,
        days: int,
        vehicle_id: Optional[str] = None,
        supplier_id: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[MaintenanceOccurrenceStatus] = None,
    ) -> MaintenanceOccurrencesResponse:
        if scope != "history":
            await self.ensure_for_filters(
                vehicle_id=vehicle_id,
                supplier_id=supplier_id,
                category=category,
            )

        today = date.today()
        window_end = today + timedelta(days=days)
        filters: list[Any] = []

        if vehicle_id:
            filters.append(
                MaintenanceOccurrence.series.has(MaintenanceSeries.vehicle_id == vehicle_id)
            )
        if supplier_id:
            filters.append(
                MaintenanceOccurrence.series.has(MaintenanceSeries.supplier_id == supplier_id)
            )
        if category:
            filters.append(
                MaintenanceOccurrence.series.has(MaintenanceSeries.category == category)
            )
        if status:
            filters.append(MaintenanceOccurrence.status == status)

        if scope == "upcoming":
            filters.append(MaintenanceOccurrence.due_date >= today)
            filters.append(MaintenanceOccurrence.due_date <= window_end)
            if not status:
                filters.append(MaintenanceOccurrence.status == MaintenanceOccurrenceStatus.OPEN)
        elif scope == "overdue":
            filters.append(MaintenanceOccurrence.due_date < today)
            if not status:
                filters.append(MaintenanceOccurrence.status == MaintenanceOccurrenceStatus.OPEN)
        elif scope == "history":
            if status is None:
                filters.append(MaintenanceOccurrence.status != MaintenanceOccurrenceStatus.OPEN)
        else:
            raise ValueError("Escopo inválido")

        options = [
            selectinload(MaintenanceOccurrence.series)
            .selectinload(MaintenanceSeries.vehicle),
            selectinload(MaintenanceOccurrence.series)
            .selectinload(MaintenanceSeries.supplier),
            selectinload(MaintenanceOccurrence.cash_txn),
        ]

        result = await self.occurrence_repo.list_occurrences(
            params,
            filters=filters,
            options=options,
        )

        items = [self._to_occurrence_read(occ) for occ in result.items]
        summary_raw = await self.occurrence_repo.summary(
            vehicle_id=vehicle_id,
            supplier_id=supplier_id,
            category=category,
            status=status,
        )
        summary = MaintenanceSummary(**summary_raw)
        return MaintenanceOccurrencesResponse(
            summary=summary,
            items=items,
            total=result.total,
            page=params.page,
            page_size=params.page_size,
        )

    async def pay_occurrence(
        self,
        occurrence_id: int,
        *,
        paid_at: Optional[date] = None,
        note: Optional[str] = None,
        cash_category_id: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> MaintenanceOccurrenceActionResponse:
        occurrence = await self._get_occurrence_with_series(occurrence_id)
        if not occurrence:
            raise ValueError("Occurrence not found")

        series = occurrence.series
        occurrence.status = MaintenanceOccurrenceStatus.PAID
        if paid_at:
            occurrence.paid_at = datetime.combine(paid_at, time.min, tzinfo=timezone.utc)
        else:
            occurrence.paid_at = datetime.now(timezone.utc)
        if note is not None:
            occurrence.note = note

        if cash_category_id:
            cash_repo = CashRepository(self.session)
            cash_note = note or f"Manutenção: {series.title}"
            txn_payload = {
                "date": occurrence.paid_at.date() if occurrence.paid_at else date.today(),
                "type": CashTxnType.OUTFLOW,
                "category_id": cash_category_id,
                "amount": occurrence.normalized_amount(),
                "method": payment_method,
                "related_vehicle_id": series.vehicle_id,
                "notes": cash_note,
            }
            if occurrence.cash_txn_id:
                existing_txn = await cash_repo.get(occurrence.cash_txn_id)
                if existing_txn:
                    await cash_repo.update_txn(existing_txn, txn_payload)
                    occurrence.cash_txn = existing_txn
                else:
                    txn = await cash_repo.create_txn(txn_payload)
                    occurrence.cash_txn_id = txn.id
                    occurrence.cash_txn = txn
            else:
                txn = await cash_repo.create_txn(txn_payload)
                occurrence.cash_txn_id = txn.id
                occurrence.cash_txn = txn
        await self.session.flush()

        await self._spawn_next_if_needed(occurrence)
        await self._refresh_series_cache(occurrence.series)

        summary_data = await self.occurrence_repo.summary()
        summary = MaintenanceSummary(**summary_data)
        return MaintenanceOccurrenceActionResponse(
            summary=summary,
            occurrence=self._to_occurrence_read(occurrence),
        )

    async def ignore_occurrence(
        self, occurrence_id: int, *, note: Optional[str] = None
    ) -> MaintenanceOccurrenceActionResponse:
        occurrence = await self._get_occurrence_with_series(occurrence_id)
        if not occurrence:
            raise ValueError("Occurrence not found")

        await self._remove_cash_txn(occurrence)
        occurrence.status = MaintenanceOccurrenceStatus.IGNORED
        occurrence.paid_at = None
        occurrence.note = note
        await self.session.flush()

        await self._spawn_next_if_needed(occurrence)
        await self._refresh_series_cache(occurrence.series)

        summary_data = await self.occurrence_repo.summary()
        summary = MaintenanceSummary(**summary_data)
        return MaintenanceOccurrenceActionResponse(
            summary=summary,
            occurrence=self._to_occurrence_read(occurrence),
        )

    async def reopen_occurrence(self, occurrence_id: int) -> MaintenanceOccurrenceActionResponse:
        occurrence = await self._get_occurrence_with_series(occurrence_id)
        if not occurrence:
            raise ValueError("Occurrence not found")

        await self._remove_cash_txn(occurrence)
        occurrence.status = MaintenanceOccurrenceStatus.OPEN
        occurrence.paid_at = None
        occurrence.note = None
        await self.session.flush()

        await self._refresh_series_cache(occurrence.series)

        summary_data = await self.occurrence_repo.summary()
        summary = MaintenanceSummary(**summary_data)
        return MaintenanceOccurrenceActionResponse(
            summary=summary,
            occurrence=self._to_occurrence_read(occurrence),
        )

    async def _spawn_next_if_needed(self, occurrence: MaintenanceOccurrence) -> None:
        series = occurrence.series
        if series.status != MaintenanceSeriesStatus.ACTIVE:
            return
        if series.frequency == MaintenanceFrequency.ON_DEMAND:
            return

        base_day = self._base_day(series)
        base_month = series.start_date.month
        next_due = self._next_due_date(occurrence.due_date, series.frequency, base_day, base_month)
        if not next_due:
            return
        if series.end_date and next_due > series.end_date:
            return
        horizon = self.desired_horizon(series.frequency)
        if next_due > horizon:
            return

        exists_stmt = select(func.count()).where(
            and_(
                MaintenanceOccurrence.series_id == series.id,
                MaintenanceOccurrence.due_date == next_due,
            )
        )
        exists = await self.session.scalar(exists_stmt)
        if exists:
            return

        next_occurrence = MaintenanceOccurrence(
            series_id=series.id,
            due_date=next_due,
            amount=series.normalized_amount(),
            status=MaintenanceOccurrenceStatus.OPEN,
        )
        self.session.add(next_occurrence)
        await self.session.flush()

    async def _remove_cash_txn(self, occurrence: MaintenanceOccurrence) -> None:
        if not occurrence.cash_txn_id:
            return
        cash_repo = CashRepository(self.session)
        txn = await cash_repo.get(occurrence.cash_txn_id)
        if txn:
            await cash_repo.delete(txn)
        occurrence.cash_txn = None
        occurrence.cash_txn_id = None

    async def _get_occurrence_with_series(self, occurrence_id: int) -> Optional[MaintenanceOccurrence]:
        stmt: Select[Any] = (
            select(MaintenanceOccurrence)
            .where(MaintenanceOccurrence.id == occurrence_id)
            .options(
                selectinload(MaintenanceOccurrence.series)
                .selectinload(MaintenanceSeries.vehicle),
                selectinload(MaintenanceOccurrence.series)
                .selectinload(MaintenanceSeries.supplier),
                selectinload(MaintenanceOccurrence.cash_txn),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _refresh_series_cache(self, series: MaintenanceSeries) -> None:
        today = date.today()
        upcoming_stmt = (
            select(MaintenanceOccurrence.due_date)
            .where(
                MaintenanceOccurrence.series_id == series.id,
                MaintenanceOccurrence.status == MaintenanceOccurrenceStatus.OPEN,
                MaintenanceOccurrence.due_date >= today,
            )
            .order_by(MaintenanceOccurrence.due_date.asc())
            .limit(1)
        )
        next_due = await self.session.scalar(upcoming_stmt)
        if next_due is None:
            fallback_stmt = (
                select(MaintenanceOccurrence.due_date)
                .where(
                    MaintenanceOccurrence.series_id == series.id,
                    MaintenanceOccurrence.status == MaintenanceOccurrenceStatus.OPEN,
                )
                .order_by(MaintenanceOccurrence.due_date.asc())
                .limit(1)
            )
            next_due = await self.session.scalar(fallback_stmt)
        series.next_due_date = next_due
        series.last_generated_at = datetime.now(timezone.utc)
        await self.session.flush()

    def _base_day(self, series: MaintenanceSeries) -> int:
        rule = series.day_rule or "same_day"
        if rule.startswith("fixed_day:"):
            _, _, value = rule.partition(":")
            try:
                day = int(value)
            except ValueError:
                day = series.start_date.day
            return max(1, min(day, 31))
        return series.start_date.day

    def _next_due_date(
        self,
        current: date,
        frequency: MaintenanceFrequency,
        base_day: int,
        base_month: int,
    ) -> Optional[date]:
        if frequency == MaintenanceFrequency.WEEKLY:
            return current + timedelta(days=7)
        if frequency == MaintenanceFrequency.MONTHLY:
            year = current.year
            month = current.month + 1
            if month > 12:
                month = 1
                year += 1
            day = min(base_day, monthrange(year, month)[1])
            return date(year, month, day)
        if frequency == MaintenanceFrequency.YEARLY:
            year = current.year + 1
            month = base_month
            day = min(base_day, monthrange(year, month)[1])
            return date(year, month, day)
        return None

    def _to_occurrence_read(self, occurrence: MaintenanceOccurrence) -> MaintenanceOccurrenceRead:
        series = occurrence.series
        vehicle: Optional[Vehicle] = getattr(series, "vehicle", None)
        supplier: Optional[Vendor] = getattr(series, "supplier", None)
        vehicle_label = series.vehicle_label if hasattr(series, "vehicle_label") else series.vehicle_id
        supplier_name = supplier.name if supplier else None
        return MaintenanceOccurrenceRead(
            id=occurrence.id,
            series_id=series.id,
            vehicle_id=series.vehicle_id,
            vehicle_label=vehicle_label,
            title=series.title,
            category=series.category,
            supplier_id=series.supplier_id,
            supplier_name=supplier_name,
            due_date=occurrence.due_date,
            frequency=series.frequency,
            amount=occurrence.normalized_amount(),
            status=occurrence.status,
            paid_at=occurrence.paid_at,
            note=occurrence.note,
            cash_txn_id=occurrence.cash_txn_id,
            cash_category_id=occurrence.cash_txn.category_id if occurrence.cash_txn else None,
            cash_payment_method=occurrence.cash_txn.method if occurrence.cash_txn else None,
        )


__all__ = ["MaintenanceService"]
