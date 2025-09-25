from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from ..models.cash import CashTxnType
from ..models.expense import Expense, ExpenseCategory
from ..models.vehicle import Vehicle
from .cash import CashRepository
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
        await self._sync_cash_for_expense(expense)
        return expense

    async def update_expense(self, expense: Expense, data: dict) -> Expense:
        for key, value in data.items():
            if value is not None and hasattr(expense, key):
                setattr(expense, key, value)
        await self.session.flush()
        await self._touch_vehicle(expense.vehicle_id)
        await self._sync_cash_for_expense(expense)
        return expense



    async def delete_expense(self, expense: Expense) -> None:
        await self._remove_cash_for_expense(expense.id)
        await super().delete(expense)
        await self.session.flush()

    async def _sync_cash_for_expense(self, expense: Expense) -> None:
        cash_repo = CashRepository(self.session)
        payload = {
            "date": expense.date,
            "type": CashTxnType.OUTFLOW,
            "category": expense.category.value,
            "amount": expense.amount,
            "method": expense.paid_with,
            "related_vehicle_id": expense.vehicle_id,
            "related_expense_id": expense.id,
            "notes": expense.notes or expense.description,
        }
        existing = await cash_repo.get_by_related_expense(expense.id)
        if existing:
            await cash_repo.update_txn(existing, payload)
        else:
            await cash_repo.create_txn(payload)

    async def _remove_cash_for_expense(self, expense_id: str) -> None:
        cash_repo = CashRepository(self.session)
        existing = await cash_repo.get_by_related_expense(expense_id)
        if existing:
            await cash_repo.delete(existing)

    async def _touch_vehicle(self, vehicle_id: str) -> None:
        vehicle = await self.session.get(Vehicle, vehicle_id)
        if vehicle:
            vehicle.sync_status()
            await self.session.flush()

