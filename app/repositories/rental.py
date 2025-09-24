from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..models.rental import Rental, RentalStatus
from ..models.vehicle import Vehicle
from ..schemas.common import PaginationParams, PaginatedResult
from ..schemas.rental import RentalClose
from .base import BaseRepository


class RentalRepository(BaseRepository[Rental]):
    model = Rental

    async def list_rentals(
        self,
        params: PaginationParams,
        status: Optional[RentalStatus] = None,
        driver_id: Optional[str] = None,
        vehicle_id: Optional[str] = None,
    ) -> PaginatedResult[Rental]:
        filters = []
        if status:
            filters.append(Rental.status == status)
        if driver_id:
            filters.append(Rental.driver_id == driver_id)
        if vehicle_id:
            filters.append(Rental.vehicle_id == vehicle_id)
        return await super().list(
            params,
            filters=filters,
            options=[selectinload(Rental.vehicle), selectinload(Rental.driver)],
        )

    async def create_rental(self, data: dict) -> Rental:
        payload = data.copy()
        payload["id"] = payload.get("id") or await self.generate_id("RENT")
        rental = Rental(**payload)
        await self.create(rental)
        await self._sync_vehicle(rental.vehicle_id, rental.driver_id)
        return rental

    async def update_rental(self, rental: Rental, data: dict) -> Rental:
        vehicle_changed = False
        driver_changed = False
        for key, value in data.items():
            if value is not None and hasattr(rental, key):
                setattr(rental, key, value)
                if key == "vehicle_id":
                    vehicle_changed = True
                if key == "driver_id":
                    driver_changed = True
        await self.session.flush()
        if vehicle_changed or driver_changed:
            await self._sync_vehicle(rental.vehicle_id, rental.driver_id)
        return rental

    async def close_rental(self, rental: Rental, payload: RentalClose) -> Rental:
        rental.end_date = payload.end_date
        rental.status = RentalStatus.CLOSED
        await self.session.flush()
        await self._sync_vehicle(rental.vehicle_id, None)
        return rental

    async def delete_rental(self, rental: Rental) -> None:
        vehicle_id = rental.vehicle_id
        await self.session.delete(rental)
        await self.session.flush()
        await self._sync_vehicle(vehicle_id, None)

    async def _sync_vehicle(self, vehicle_id: str, driver_id: Optional[str]) -> None:
        vehicle = await self.session.get(Vehicle, vehicle_id)
        if vehicle:
            vehicle.current_driver_id = driver_id
            vehicle.sync_status()
            await self.session.flush()

