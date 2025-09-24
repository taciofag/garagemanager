from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.vehicle import VehicleStatus
from .common import DecimalModel


class VehicleBase(DecimalModel):
    plate: str = Field(max_length=10)
    renavam: str = Field(max_length=20)
    vin: str = Field(max_length=20)
    manufacture_year: int = Field(ge=1900, le=2100)
    model_year: int = Field(ge=1900, le=2100)
    make: str = Field(max_length=50)
    model: str = Field(max_length=50)
    color: Optional[str] = Field(default=None, max_length=30)
    acquisition_date: date
    acquisition_price: Decimal
    sale_date: Optional[date] = None
    sale_price: Optional[Decimal] = None
    sale_fees: Optional[Decimal] = None
    current_driver_id: Optional[str] = None
    odometer_in: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=255)


class VehicleCreate(VehicleBase):
    id: Optional[str] = Field(default=None, max_length=12)


class VehicleUpdate(DecimalModel):
    plate: Optional[str] = Field(default=None, max_length=10)
    renavam: Optional[str] = Field(default=None, max_length=20)
    vin: Optional[str] = Field(default=None, max_length=20)
    manufacture_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    model_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    make: Optional[str] = Field(default=None, max_length=50)
    model: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, max_length=30)
    acquisition_date: Optional[date] = None
    acquisition_price: Optional[Decimal] = None
    sale_date: Optional[date] = None
    sale_price: Optional[Decimal] = None
    sale_fees: Optional[Decimal] = None
    current_driver_id: Optional[str] = None
    odometer_in: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=255)


class VehicleSell(BaseModel):
    sale_date: date
    sale_price: Decimal
    sale_fees: Decimal = Decimal("0")


class VehicleRead(VehicleBase):
    id: str
    status: VehicleStatus
    total_expenses: Decimal
    total_cost: Decimal
    sale_net: Optional[Decimal]
    profit: Optional[Decimal]
    roi: Optional[Decimal]

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }
