from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import selectinload

from ..models.maintenance import (
    MaintenanceFrequency,
    MaintenanceOccurrence,
    MaintenanceOccurrenceStatus,
    MaintenanceSeries,
    MaintenanceSeriesStatus,
)
from ..models.common import quantize_decimal
from ..schemas.common import PaginatedResult, PaginationParams
from .base import BaseRepository


class MaintenanceSeriesRepository(BaseRepository[MaintenanceSeries]):
    model = MaintenanceSeries

    @classmethod
    def default_order_attr(cls, params: PaginationParams):  # type: ignore[override]
        return MaintenanceSeries.created_at

    async def create_series(self, data: dict[str, Any]) -> MaintenanceSeries:
        payload = data.copy()
        payload.setdefault("status", MaintenanceSeriesStatus.ACTIVE)
        payload.setdefault("day_rule", "same_day")
        if payload.get("amount") is not None:
            payload["amount"] = quantize_decimal(payload["amount"]) or Decimal("0")
        series = MaintenanceSeries(**payload)
        await self.create(series)
        await self.session.flush()
        await self.session.refresh(series)
        await self.session.refresh(series, attribute_names=["vehicle", "supplier"])
        return series

    async def update_series(self, series: MaintenanceSeries, data: dict[str, Any]) -> MaintenanceSeries:
        for key, value in data.items():
            if not hasattr(series, key):
                continue
            if key == "amount" and value is not None:
                setattr(series, key, quantize_decimal(value) or Decimal("0"))
            else:
                setattr(series, key, value)
        await self.session.flush()
        await self.session.refresh(series)
        await self.session.refresh(series, attribute_names=["vehicle", "supplier"])
        return series

    async def list_for_horizon(
        self,
        *,
        vehicle_id: Optional[str] = None,
        supplier_id: Optional[str] = None,
        category: Optional[str] = None,
        include_inactive: bool = False,
    ) -> list[MaintenanceSeries]:
        stmt: Select[Any] = select(MaintenanceSeries)
        filters: list[Any] = []
        if not include_inactive:
            filters.append(MaintenanceSeries.status == MaintenanceSeriesStatus.ACTIVE)
        if vehicle_id:
            filters.append(MaintenanceSeries.vehicle_id == vehicle_id)
        if supplier_id:
            filters.append(MaintenanceSeries.supplier_id == supplier_id)
        if category:
            filters.append(MaintenanceSeries.category == category)
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = stmt.options(
            selectinload(MaintenanceSeries.vehicle),
            selectinload(MaintenanceSeries.supplier),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class MaintenanceOccurrenceRepository(BaseRepository[MaintenanceOccurrence]):
    model = MaintenanceOccurrence

    @classmethod
    def default_order_attr(cls, params: PaginationParams):  # type: ignore[override]
        return MaintenanceOccurrence.due_date

    async def list_occurrences(
        self,
        params: PaginationParams,
        *,
        filters: Sequence[Any] | None = None,
        options: Sequence[Any] | None = None,
    ) -> PaginatedResult[MaintenanceOccurrence]:
        return await super().list(params, filters=filters, options=options)

    async def summary(
        self,
        *,
        vehicle_id: Optional[str] = None,
        supplier_id: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[MaintenanceOccurrenceStatus] = None,
        reference: Optional[date] = None,
    ) -> dict[str, Decimal | int]:
        ref_date = reference or date.today()
        base_filters: list[Any] = []
        if vehicle_id:
            base_filters.append(MaintenanceSeries.vehicle_id == vehicle_id)
        if supplier_id:
            base_filters.append(MaintenanceSeries.supplier_id == supplier_id)
        if category:
            base_filters.append(MaintenanceSeries.category == category)
        if status:
            base_filters.append(MaintenanceOccurrence.status == status)

        stmt = (
            select(
                MaintenanceOccurrence.status,
                MaintenanceOccurrence.due_date,
                MaintenanceOccurrence.amount,
                MaintenanceOccurrence.paid_at,
            )
            .join(MaintenanceSeries, MaintenanceSeries.id == MaintenanceOccurrence.series_id)
        )
        if base_filters:
            stmt = stmt.where(and_(*base_filters))
        rows = (await self.session.execute(stmt)).all()

        open_total = 0
        overdue_total = 0
        expected_this_month = Decimal("0")
        paid_this_month = Decimal("0")
        for status_value, due_date_value, amount_value, paid_at_value in rows:
            status_enum = (
                status_value
                if isinstance(status_value, MaintenanceOccurrenceStatus)
                else MaintenanceOccurrenceStatus(status_value)
            )
            amount_decimal = Decimal(amount_value or 0)
            if status_enum == MaintenanceOccurrenceStatus.OPEN:
                open_total += 1
                if due_date_value and due_date_value < ref_date:
                    overdue_total += 1
                if (
                    due_date_value
                    and due_date_value.year == ref_date.year
                    and due_date_value.month == ref_date.month
                ):
                    expected_this_month += amount_decimal
            if (
                status_enum == MaintenanceOccurrenceStatus.PAID
                and paid_at_value
                and paid_at_value.year == ref_date.year
                and paid_at_value.month == ref_date.month
            ):
                paid_this_month += amount_decimal

        return {
            "open": open_total,
            "overdue": overdue_total,
            "expected_this_month": quantize_decimal(expected_this_month) or Decimal("0"),
            "paid_this_month": quantize_decimal(paid_this_month) or Decimal("0"),
        }


__all__ = [
    "MaintenanceSeriesRepository",
    "MaintenanceOccurrenceRepository",
]
