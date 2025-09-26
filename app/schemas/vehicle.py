from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional, Annotated

from pydantic import BaseModel, Field

from ..models.rental import RentalStatus
from ..models.vehicle import VehicleStatus
from .common import DecimalModel
from .expense import ExpenseRead
from .rent_payment import RentPaymentRead


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
    sale_date: Annotated[Optional[date], Field(default=None)]
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
    acquisition_date: Annotated[Optional[date], Field(default=None)]
    acquisition_price: Optional[Decimal] = None
    sale_date: Annotated[Optional[date], Field(default=None)]
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


class VehicleRentalSummary(BaseModel):
    id: str
    driver_id: str
    start_date: date
    end_date: Optional[date]
    status: RentalStatus
    payments: list[RentPaymentRead]
    total_due: Decimal
    total_paid: Decimal
    total_late_fee: Decimal

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }


class VehicleFinancialSummary(BaseModel):
    vehicle: VehicleRead
    acquisition_price: Decimal
    total_expenses: Decimal
    expenses: list[ExpenseRead]
    rentals: list[VehicleRentalSummary]
    total_rent_paid: Decimal
    total_rent_due: Decimal
    total_late_fee: Decimal
    sale_price: Optional[Decimal]
    sale_fees: Optional[Decimal]
    sale_net: Optional[Decimal]
    total_cost: Decimal
    total_income: Decimal
    profit: Optional[Decimal]

    model_config = {
        "json_encoders": {Decimal: lambda v: str(v)},
    }
