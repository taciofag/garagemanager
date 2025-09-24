from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_

from ..models.capital import CapitalEntry, CapitalType
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
        return entry

    async def update_capital(self, entry: CapitalEntry, data: dict) -> CapitalEntry:
        for key, value in data.items():
            if value is not None and hasattr(entry, key):
                setattr(entry, key, value)
        await self.session.flush()
        return entry

