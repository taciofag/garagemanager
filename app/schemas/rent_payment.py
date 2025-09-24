from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from .common import DecimalModel


class RentPaymentBase(DecimalModel):
    rental_id: str = Field(max_length=12)
    period_start: date
    period_end: date
    weekly_rate: Decimal
    weeks: int = 1
    due_amount: Decimal
    paid_amount: Decimal = Decimal("0")
    payment_date: Optional[date] = None
    late_fee: Decimal = Decimal("0")
    method: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=255)


class RentPaymentCreate(RentPaymentBase):
    id: Optional[str] = Field(default=None, max_length=12)


class RentPaymentUpdate(DecimalModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    weekly_rate: Optional[Decimal] = None
    weeks: Optional[int] = None
    due_amount: Optional[Decimal] = None
    paid_amount: Optional[Decimal] = None
    payment_date: Optional[date] = None
    late_fee: Optional[Decimal] = None
    method: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=255)


class RentPaymentRead(RentPaymentBase):
    id: str
    balance: Decimal

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }


class RentPaymentGenerate(BaseModel):
    rental_id: str = Field(max_length=12)
    period_start: date
    period_end: date

