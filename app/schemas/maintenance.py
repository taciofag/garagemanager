from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.maintenance import MaintenanceCategory, MaintenanceFrequency, MaintenanceStatus
from .common import PaginationParams


class MaintenanceFilters(BaseModel):
    status: Optional[MaintenanceStatus] = None
    vehicle_id: Optional[str] = Field(default=None, max_length=12)
    category: Optional[MaintenanceCategory] = None
    upcoming_until: Optional[date] = None


class VehicleMaintenanceBase(BaseModel):
    vehicle_id: str = Field(max_length=12)
    title: str = Field(max_length=120)
    category: MaintenanceCategory
    frequency: Optional[MaintenanceFrequency] = None
    due_date: Optional[date] = None
    odometer_due: Optional[int] = Field(default=None, ge=0)
    amount: Decimal = Decimal("0")
    status: MaintenanceStatus = MaintenanceStatus.OPEN
    notes: Optional[str] = Field(default=None, max_length=255)
    vendor_id: Optional[str] = Field(default=None, max_length=12)


class VehicleMaintenanceCreate(VehicleMaintenanceBase):
    pass


class VehicleMaintenanceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    category: Optional[MaintenanceCategory] = None
    frequency: Optional[MaintenanceFrequency] = None
    due_date: Optional[date] = None
    odometer_due: Optional[int] = Field(default=None, ge=0)
    amount: Optional[Decimal] = None
    status: Optional[MaintenanceStatus] = None
    notes: Optional[str] = Field(default=None, max_length=255)
    completed_at: Optional[date] = None
    vendor_id: Optional[str] = Field(default=None, max_length=12)


class VehicleMaintenanceRead(VehicleMaintenanceBase):
    id: str
    completed_at: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    vendor_name: Optional[str] = None
    series_id: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }


class MaintenanceListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[VehicleMaintenanceRead]


class MaintenanceListRequest(BaseModel):
    pagination: PaginationParams
    filters: Optional[MaintenanceFilters] = None
