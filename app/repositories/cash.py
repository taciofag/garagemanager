from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from ..models.cash import CashCategory, CashTxn, CashTxnType
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class CashRepository(BaseRepository[CashTxn]):
    model = CashTxn

    async def list_txns(
        self,
        params: PaginationParams,
        type: Optional[CashTxnType] = None,
        category_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PaginatedResult[CashTxn]:
        filters = []
        if type:
            filters.append(CashTxn.type == type)
        if category_id:
            filters.append(CashTxn.category_id == category_id)
        period_filters = []
        if start_date:
            period_filters.append(CashTxn.date >= start_date)
        if end_date:
            period_filters.append(CashTxn.date <= end_date)
        if period_filters:
            filters.append(and_(*period_filters))
        return await super().list(
            params,
            filters=filters,
            options=[
                selectinload(CashTxn.category),
                selectinload(CashTxn.related_vehicle),
                selectinload(CashTxn.related_rental),
                selectinload(CashTxn.related_expense),
                selectinload(CashTxn.related_capital),
            ],
        )

    async def create_txn(self, data: dict) -> CashTxn:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("CSH")
        category_id = payload.get("category_id")
        if not category_id:
            raise ValueError("category_id is required")
        category = await self.session.get(CashCategory, category_id)
        if not category:
            raise ValueError("Categoria de caixa inválida")
        txn = CashTxn(**payload)
        await self.create(txn)
        await self.session.refresh(txn, attribute_names=["category"])
        return txn

    async def update_txn(self, txn: CashTxn, data: dict) -> CashTxn:
        payload = data.copy()
        if "category_id" in payload and payload["category_id"] is not None:
            category = await self.session.get(CashCategory, payload["category_id"])
            if not category:
                raise ValueError("Categoria de caixa inválida")
        for key, value in payload.items():
            if hasattr(txn, key):
                setattr(txn, key, value)
        await self.session.flush()
        await self.session.refresh(txn, attribute_names=["category"])
        return txn

    async def get_by_related_expense(self, expense_id: str) -> Optional[CashTxn]:
        stmt = select(CashTxn).where(CashTxn.related_expense_id == expense_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_related_capital(self, capital_id: str) -> Optional[CashTxn]:
        stmt = select(CashTxn).where(CashTxn.related_capital_id == capital_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
