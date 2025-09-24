from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from ..models.vendor import Vendor, VendorType
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class VendorRepository(BaseRepository[Vendor]):
    model = Vendor

    async def list_vendors(
        self,
        params: PaginationParams,
        type: Optional[VendorType] = None,
        name: Optional[str] = None,
    ) -> PaginatedResult[Vendor]:
        filters = []
        if type:
            filters.append(Vendor.type == type)
        if name:
            filters.append(Vendor.name.ilike(f"%{name}%"))
        return await super().list(params, filters=filters)

    async def create_vendor(self, data: dict) -> Vendor:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("VND")
        vendor = Vendor(**payload)
        await self.create(vendor)
        return vendor

    async def update_vendor(self, vendor: Vendor, data: dict) -> Vendor:
        for key, value in data.items():
            if value is not None and hasattr(vendor, key):
                setattr(vendor, key, value)
        await self.session.flush()
        return vendor

