from __future__ import annotations

from datetime import date
from typing import Optional, Sequence

from dateutil.relativedelta import relativedelta
from sqlalchemy import Select, and_, select
from sqlalchemy.orm import selectinload

from ..models.maintenance import (
    MaintenanceCategory,
    MaintenanceFrequency,
    MaintenanceStatus,
    VehicleMaintenance,
)
from ..models.common import quantize_decimal
from ..schemas.common import PaginatedResult, PaginationParams
from .base import BaseRepository


class VehicleMaintenanceRepository(BaseRepository[VehicleMaintenance]):
    model = VehicleMaintenance

    RECURRING_INTERVALS = {
        MaintenanceFrequency.MONTHLY: relativedelta(months=1),
        MaintenanceFrequency.QUARTERLY: relativedelta(months=3),
        MaintenanceFrequency.SEMIANNUAL: relativedelta(months=6),
        MaintenanceFrequency.ANNUAL: relativedelta(months=12),
    }

    @classmethod
    def default_order_attr(cls, params: PaginationParams):  # type: ignore[override]
        return VehicleMaintenance.due_date

    async def list_tasks(
        self,
        params: PaginationParams,
        *,
        status: Optional[MaintenanceStatus] = None,
        vehicle_id: Optional[str] = None,
        category: Optional[MaintenanceCategory] = None,
        upcoming_until: Optional[date] = None,
        vendor_id: Optional[str] = None,
    ) -> PaginatedResult[VehicleMaintenance]:
        filters: list[Select] = []
        if status:
            filters.append(VehicleMaintenance.status == status)
        if vehicle_id:
            filters.append(VehicleMaintenance.vehicle_id == vehicle_id)
        if category:
            filters.append(VehicleMaintenance.category == category)
        if vendor_id:
            filters.append(VehicleMaintenance.vendor_id == vendor_id)
        if upcoming_until:
            filters.append(
                and_(
                    VehicleMaintenance.due_date.is_not(None),
                    VehicleMaintenance.due_date <= upcoming_until,
                )
            )
        return await super().list(
            params,
            filters=filters,
            options=[selectinload(VehicleMaintenance.vendor)],
        )

    async def create_task(self, data: dict) -> VehicleMaintenance:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("MTN")
        payload["series_id"] = payload.get("series_id") or payload["id"]
        if "vendor_id" in payload and not payload["vendor_id"]:
            payload["vendor_id"] = None
        if "amount" in payload and payload["amount"] is not None:
            payload["amount"] = quantize_decimal(payload["amount"]) or 0
        task = VehicleMaintenance(**payload)
        await self.create(task)
        await self.session.flush()
        await self.session.refresh(task)
        await self.session.refresh(task, attribute_names=["vendor"])
        await self._ensure_future_occurrences(task)
        return task

    async def update_task(self, task: VehicleMaintenance, data: dict) -> VehicleMaintenance:
        for key, value in data.items():
            if hasattr(task, key) and value is not None:
                if key == "amount":
                    setattr(task, key, quantize_decimal(value) or 0)
                elif key == "vendor_id" and not value:
                    setattr(task, key, None)
                elif key == "completed_at" and value is None:
                    setattr(task, key, None)
                else:
                    setattr(task, key, value)
        await self.session.flush()
        await self.session.refresh(task)
        await self.session.refresh(task, attribute_names=["vendor"])
        await self._ensure_future_occurrences(task)
        return task

    async def delete_task(self, task: VehicleMaintenance) -> None:
        await self.session.delete(task)

    async def complete_task(
        self,
        task: VehicleMaintenance,
        *,
        completed_at: Optional[date] = None,
        status: MaintenanceStatus = MaintenanceStatus.COMPLETED,
    ) -> VehicleMaintenance:
        task.status = status
        task.completed_at = completed_at or date.today()
        await self.session.flush()
        await self.session.refresh(task)
        await self.session.refresh(task, attribute_names=["vendor"])
        await self._ensure_future_occurrences(task)
        return task

    async def ensure_all_series_future(self, months_ahead: int = 6) -> int:
        stmt = select(VehicleMaintenance.series_id).distinct()
        series_ids: Sequence[str] = [row.series_id for row in (await self.session.execute(stmt)).all()]
        created = 0
        for series_id in series_ids:
            seed = await self._get_latest_for_series(series_id)
            if seed:
                created += len(await self._ensure_future_occurrences(seed, months_ahead=months_ahead))
        return created

    async def _ensure_future_occurrences(
        self,
        seed: VehicleMaintenance,
        *,
        months_ahead: int = 6,
    ) -> list[VehicleMaintenance]:
        if not seed.due_date:
            return []
        if seed.frequency not in self.RECURRING_INTERVALS:
            return []

        existing_due_dates = await self._existing_due_dates(seed.series_id)
        if not existing_due_dates:
            existing_due_dates = [seed.due_date]
        last_due = max(existing_due_dates)

        target = max(date.today(), last_due) + relativedelta(months=months_ahead)
        results: list[VehicleMaintenance] = []

        while True:
            next_due = self._calculate_next_due(last_due, seed.frequency)
            if next_due is None or next_due > target:
                break
            if next_due in existing_due_dates:
                last_due = next_due
                continue
            payload = {
                "id": await self.generate_id("MTN"),
                "series_id": seed.series_id,
                "vehicle_id": seed.vehicle_id,
                "title": seed.title,
                "category": seed.category,
                "frequency": seed.frequency,
                "due_date": next_due,
                "odometer_due": seed.odometer_due,
                "amount": quantize_decimal(seed.amount) if seed.amount is not None else quantize_decimal(0),
                "status": MaintenanceStatus.OPEN,
                "completed_at": None,
                "notes": seed.notes,
                "vendor_id": seed.vendor_id,
            }
            occurrence = VehicleMaintenance(**payload)
            await self.create(occurrence)
            await self.session.flush()
            await self.session.refresh(occurrence)
            await self.session.refresh(occurrence, attribute_names=["vendor"])
            results.append(occurrence)
            existing_due_dates.append(next_due)
            last_due = next_due

        return results

    async def _existing_due_dates(self, series_id: str) -> list[date]:
        stmt = select(VehicleMaintenance.due_date).where(VehicleMaintenance.series_id == series_id)
        rows = (await self.session.execute(stmt)).all()
        return [row.due_date for row in rows if row.due_date]

    async def _get_latest_for_series(self, series_id: str) -> Optional[VehicleMaintenance]:
        stmt = (
            select(VehicleMaintenance)
            .where(VehicleMaintenance.series_id == series_id)
            .order_by(VehicleMaintenance.due_date.desc())
            .limit(1)
            .options(selectinload(VehicleMaintenance.vendor))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _calculate_next_due(
        self, due_date: date, frequency: MaintenanceFrequency
    ) -> Optional[date]:
        interval = self.RECURRING_INTERVALS.get(frequency)
        if not interval:
            return None
        return due_date + interval


__all__ = ["VehicleMaintenanceRepository"]
