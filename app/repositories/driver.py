from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from ..models.driver import Driver, DriverStatus
from ..schemas.common import PaginationParams, PaginatedResult
from .base import BaseRepository


class DriverRepository(BaseRepository[Driver]):
    model = Driver

    async def list_drivers(
        self,
        params: PaginationParams,
        status: Optional[DriverStatus] = None,
        name: Optional[str] = None,
    ) -> PaginatedResult[Driver]:
        filters = []
        if status:
            filters.append(Driver.status == status)
        if name:
            filters.append(Driver.name.ilike(f"%{name}%"))
        return await super().list(params, filters=filters)

    async def get_by_cpf(self, cpf: str) -> Optional[Driver]:
        stmt = select(Driver).where(Driver.cpf == cpf)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create_driver(self, data: dict) -> Driver:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("DRV")
        driver = Driver(**payload)
        await self.create(driver)
        return driver

    async def update_driver(self, driver: Driver, data: dict) -> Driver:
        for key, value in data.items():
            if value is not None and hasattr(driver, key):
                setattr(driver, key, value)
        await self.session.flush()
        return driver

