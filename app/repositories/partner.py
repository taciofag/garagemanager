from __future__ import annotations

from typing import Optional

from ..models.partner import Partner
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class PartnerRepository(BaseRepository[Partner]):
    model = Partner

    async def list_partners(
        self,
        params: PaginationParams,
        name: Optional[str] = None,
    ) -> PaginatedResult[Partner]:
        filters = []
        if name:
            filters.append(Partner.name.ilike(f"%{name}%"))
        return await super().list(params, filters=filters)

    async def create_partner(self, data: dict) -> Partner:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("PRT")
        partner = Partner(**payload)
        await self.create(partner)
        return partner

    async def update_partner(self, partner: Partner, data: dict) -> Partner:
        for key, value in data.items():
            if value is not None and hasattr(partner, key):
                setattr(partner, key, value)
        await self.session.flush()
        return partner
