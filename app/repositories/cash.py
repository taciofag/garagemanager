from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_

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
            if value is not None and hasattr(txn, key):
                setattr(txn, key, value)
        await self.session.flush()
        return txn

