from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.driver import DriverStatus
from .common import DecimalModel


class DriverBase(DecimalModel):
    name: str = Field(max_length=100)
    cpf: str = Field(max_length=14)
    phone: Optional[str] = Field(default=None, max_length=20)
    start_date: date
    weekly_rate: Decimal
    commission_pct: Decimal = Decimal("0")
    deposit_held: Decimal = Decimal("0")
    status: DriverStatus = DriverStatus.ACTIVE
    notes: Optional[str] = Field(default=None, max_length=255)


class DriverCreate(DriverBase):
    id: Optional[str] = Field(default=None, max_length=12)


class DriverUpdate(DecimalModel):
    name: Optional[str] = Field(default=None, max_length=100)
    cpf: Optional[str] = Field(default=None, max_length=14)
    phone: Optional[str] = Field(default=None, max_length=20)
    start_date: Optional[date] = None
    weekly_rate: Optional[Decimal] = None
    commission_pct: Optional[Decimal] = None
    deposit_held: Optional[Decimal] = None
    status: Optional[DriverStatus] = None
    notes: Optional[str] = Field(default=None, max_length=255)


class DriverRead(DriverBase):
    id: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }
