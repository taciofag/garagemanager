from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_

from ..models.cash import CashTxnType
from ..models.capital import CapitalEntry, CapitalType
from .cash import CashRepository
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class CapitalRepository(BaseRepository[CapitalEntry]):
    model = CapitalEntry

    async def list_capital(
        self,
        params: PaginationParams,
        partner: Optional[str] = None,
        type: Optional[CapitalType] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PaginatedResult[CapitalEntry]:
        filters = []
        if partner:
            filters.append(CapitalEntry.partner.ilike(f"%{partner}%"))
        if type:
            filters.append(CapitalEntry.type == type)
        period_filters = []
        if start_date:
            period_filters.append(CapitalEntry.date >= start_date)
        if end_date:
            period_filters.append(CapitalEntry.date <= end_date)
        if period_filters:
            filters.append(and_(*period_filters))
        return await super().list(params, filters=filters)

    async def create_capital(self, data: dict) -> CapitalEntry:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("CAP")
        entry = CapitalEntry(**payload)
        await self.create(entry)
        await self._sync_cash_for_capital(entry)
        return entry

    async def update_capital(self, entry: CapitalEntry, data: dict) -> CapitalEntry:
        for key, value in data.items():
            if value is not None and hasattr(entry, key):
                setattr(entry, key, value)
        await self.session.flush()
        await self._sync_cash_for_capital(entry)
        return entry

    async def delete_capital_entry(self, entry: CapitalEntry) -> None:
        await self._remove_cash_for_capital(entry.id)
        await super().delete(entry)
        await self.session.flush()

    async def _sync_cash_for_capital(self, entry: CapitalEntry) -> None:
        cash_repo = CashRepository(self.session)
        cash_type = CashTxnType.INFLOW if entry.type == CapitalType.CONTRIBUTION else CashTxnType.OUTFLOW
        payload = {
            "date": entry.date,
            "type": cash_type,
            "category": "Capital",
            "amount": entry.amount,
            "related_capital_id": entry.id,
            "notes": entry.notes or f"{entry.partner} - {entry.type.value}",
        }
        existing = await cash_repo.get_by_related_capital(entry.id)
        if existing:
            await cash_repo.update_txn(existing, payload)
        else:
            await cash_repo.create_txn(payload)

    async def _remove_cash_for_capital(self, capital_id: str) -> None:
        cash_repo = CashRepository(self.session)
        existing = await cash_repo.get_by_related_capital(capital_id)
        if existing:
            await cash_repo.delete(existing)

