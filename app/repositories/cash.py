from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, select

from ..models.cash import CashTxn, CashTxnType
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class CashRepository(BaseRepository[CashTxn]):
    model = CashTxn

    async def list_txns(
        self,
        params: PaginationParams,
        type: Optional[CashTxnType] = None,
        category: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PaginatedResult[CashTxn]:
        filters = []
        if type:
            filters.append(CashTxn.type == type)
        if category:
            filters.append(CashTxn.category.ilike(f"%{category}%"))
        period_filters = []
        if start_date:
            period_filters.append(CashTxn.date >= start_date)
        if end_date:
            period_filters.append(CashTxn.date <= end_date)
        if period_filters:
            filters.append(and_(*period_filters))
        return await super().list(params, filters=filters)

    async def create_txn(self, data: dict) -> CashTxn:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("CSH")
        txn = CashTxn(**payload)
        await self.create(txn)
        return txn

    async def update_txn(self, txn: CashTxn, data: dict) -> CashTxn:
        for key, value in data.items():
            if hasattr(txn, key):
                setattr(txn, key, value)
        await self.session.flush()
        return txn

    async def get_by_related_expense(self, expense_id: str) -> Optional[CashTxn]:
        stmt = select(CashTxn).where(CashTxn.related_expense_id == expense_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_related_capital(self, capital_id: str) -> Optional[CashTxn]:
        stmt = select(CashTxn).where(CashTxn.related_capital_id == capital_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

