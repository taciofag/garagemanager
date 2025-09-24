from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload

from ..models.vehicle import Vehicle, VehicleStatus
from ..schemas.common import PaginationParams, PaginatedResult
from ..schemas.vehicle import VehicleSell
from .base import BaseRepository


class VehicleRepository(BaseRepository[Vehicle]):
    model = Vehicle

    async def list_vehicles(
        self,
        params: PaginationParams,
        status: Optional[VehicleStatus] = None,
        make: Optional[str] = None,
        model: Optional[str] = None,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        in_stock: Optional[bool] = None,
        rented: Optional[bool] = None,
        sold: Optional[bool] = None,
    ) -> PaginatedResult[Vehicle]:
        filters = []
        if status:
            filters.append(Vehicle.status == status)
        if make:
            filters.append(Vehicle.make.ilike(f"%{make}%"))
        if model:
            filters.append(Vehicle.model.ilike(f"%{model}%"))
        if year_from:
            filters.append(Vehicle.model_year >= year_from)
        if year_to:
            filters.append(Vehicle.model_year <= year_to)
        status_filters = []
        if in_stock:
            status_filters.append(Vehicle.status == VehicleStatus.STOCK)
        if rented:
            status_filters.append(Vehicle.status == VehicleStatus.RENTED)
        if sold:
            status_filters.append(Vehicle.status == VehicleStatus.SOLD)
        if status_filters:
            filters.append(or_(*status_filters))
        result = await super().list(
            params,
            filters=filters,
            options=[selectinload(Vehicle.expenses)],
        )
        for vehicle in result.items:
            vehicle.sync_status()
        return result

    async def get(self, vehicle_id: str) -> Optional[Vehicle]:
        stmt = (
            select(Vehicle)
            .options(selectinload(Vehicle.expenses))
            .where(Vehicle.id == vehicle_id)
        )
        result = await self.session.execute(stmt)
        vehicle = result.scalar_one_or_none()
        if vehicle:
            vehicle.sync_status()
        return vehicle

    async def get_by_plate(self, plate: str) -> Optional[Vehicle]:
        stmt = select(Vehicle).where(Vehicle.plate == plate)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def _sanitize_payload(payload: dict) -> dict:
        data = payload.copy()
        if 'plate' in data and data['plate'] is not None:
            data['plate'] = str(data['plate']).replace('-', '').upper()
        if 'renavam' in data and data['renavam'] is not None:
            data['renavam'] = str(data['renavam']).strip()
        if 'vin' in data and data['vin'] is not None:
            data['vin'] = str(data['vin']).upper()
        if 'make' in data and data['make'] is not None:
            data['make'] = str(data['make']).strip()
        if 'model' in data and data['model'] is not None:
            data['model'] = str(data['model']).strip()
        if 'manufacture_year' in data and data['manufacture_year'] is not None:
            value = data['manufacture_year']
            data['manufacture_year'] = int(value) if str(value).strip() else None
        if 'model_year' in data and data['model_year'] is not None:
            value = data['model_year']
            data['model_year'] = int(value) if str(value).strip() else None
        if 'color' in data and data['color'] is not None:
            data['color'] = str(data['color']).strip()
        if 'notes' in data and data['notes'] is not None:
            data['notes'] = str(data['notes']).strip()
        if 'acquisition_price' in data and data['acquisition_price'] is not None:
            data['acquisition_price'] = Decimal(str(data['acquisition_price']))
        if 'sale_price' in data and data['sale_price'] is not None:
            data['sale_price'] = Decimal(str(data['sale_price']))
        if 'sale_fees' in data and data['sale_fees'] is not None:
            data['sale_fees'] = Decimal(str(data['sale_fees']))
        return data

    async def create_vehicle(self, data: dict) -> Vehicle:
        payload = self._sanitize_payload(data)
        payload['id'] = payload.get('id') or await self.generate_id('CAR')
        vehicle = Vehicle(**payload)
        vehicle.sync_status()
        await self.create(vehicle)
        return vehicle

    async def update_vehicle(self, vehicle: Vehicle, data: dict) -> Vehicle:
        sanitized = self._sanitize_payload(data)
        for key, value in sanitized.items():
            if hasattr(vehicle, key) and value is not None:
                setattr(vehicle, key, value)
        vehicle.sync_status()
        await self.session.flush()
        return vehicle

    async def sell_vehicle(self, vehicle: Vehicle, payload: VehicleSell) -> Vehicle:
        vehicle.sale_date = payload.sale_date
        vehicle.sale_price = Decimal(payload.sale_price)
        vehicle.sale_fees = Decimal(payload.sale_fees)
        vehicle.current_driver_id = None
        vehicle.sync_status()
        await self.session.flush()
        return vehicle

