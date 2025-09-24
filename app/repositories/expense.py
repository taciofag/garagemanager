from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from ..models.expense import Expense, ExpenseCategory
from ..models.vehicle import Vehicle
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class ExpenseRepository(BaseRepository[Expense]):
    model = Expense

    async def list_expenses(
        self,
        params: PaginationParams,
        vehicle_id: Optional[str] = None,
        category: Optional[ExpenseCategory] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PaginatedResult[Expense]:
        filters = []
        if vehicle_id:
            filters.append(Expense.vehicle_id == vehicle_id)
        if category:
            filters.append(Expense.category == category)
        period_filters = []
        if start_date:
            period_filters.append(Expense.date >= start_date)
        if end_date:
            period_filters.append(Expense.date <= end_date)
        if period_filters:
            filters.append(and_(*period_filters))
        return await super().list(params, filters=filters, options=[selectinload(Expense.vehicle)])

    async def create_expense(self, data: dict) -> Expense:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("EXP")
        expense = Expense(**payload)
        await self.create(expense)
        await self._touch_vehicle(expense.vehicle_id)
        return expense

    async def update_expense(self, expense: Expense, data: dict) -> Expense:
        for key, value in data.items():
            if value is not None and hasattr(expense, key):
                setattr(expense, key, value)
        await self.session.flush()
        await self._touch_vehicle(expense.vehicle_id)
        return expense

    async def _touch_vehicle(self, vehicle_id: str) -> None:
        vehicle = await self.session.get(Vehicle, vehicle_id)
        if vehicle:
            vehicle.sync_status()
            await self.session.flush()

