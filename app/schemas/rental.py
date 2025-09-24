from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.rental import BillingDay, RentalStatus
from .common import DecimalModel


class RentalBase(DecimalModel):
    vehicle_id: str = Field(max_length=12)
    driver_id: str = Field(max_length=12)
    start_date: date
    end_date: Optional[date] = None
    weekly_rate: Decimal
    deposit: Decimal = Decimal("0")
    billing_day: BillingDay
    status: RentalStatus = RentalStatus.ACTIVE
    notes: Optional[str] = Field(default=None, max_length=255)


class RentalCreate(RentalBase):
    id: Optional[str] = Field(default=None, max_length=12)


class RentalUpdate(DecimalModel):
    vehicle_id: Optional[str] = Field(default=None, max_length=12)
    driver_id: Optional[str] = Field(default=None, max_length=12)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    weekly_rate: Optional[Decimal] = None
    deposit: Optional[Decimal] = None
    billing_day: Optional[BillingDay] = None
    status: Optional[RentalStatus] = None
    notes: Optional[str] = Field(default=None, max_length=255)


class RentalClose(BaseModel):
    end_date: date


class RentalRead(RentalBase):
    id: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }
