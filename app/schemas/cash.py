from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.cash import CashTxnType
from .common import DecimalModel


class CashTxnBase(DecimalModel):
    date: date
    type: CashTxnType
    category: str = Field(max_length=50)
    amount: Decimal
    method: Optional[str] = Field(default=None, max_length=50)
    related_vehicle_id: Optional[str] = Field(default=None, max_length=12)
    related_rental_id: Optional[str] = Field(default=None, max_length=12)
    related_expense_id: Optional[str] = Field(default=None, max_length=12)
    related_capital_id: Optional[str] = Field(default=None, max_length=12)
    notes: Optional[str] = Field(default=None, max_length=255)


class CashTxnCreate(CashTxnBase):
    id: Optional[str] = Field(default=None, max_length=12)


class CashTxnUpdate(DecimalModel):
    date: Optional[date] = None
    type: Optional[CashTxnType] = None
    category: Optional[str] = Field(default=None, max_length=50)
    amount: Optional[Decimal] = None
    method: Optional[str] = Field(default=None, max_length=50)
    related_vehicle_id: Optional[str] = Field(default=None, max_length=12)
    related_rental_id: Optional[str] = Field(default=None, max_length=12)
    related_expense_id: Optional[str] = Field(default=None, max_length=12)
    related_capital_id: Optional[str] = Field(default=None, max_length=12)
    notes: Optional[str] = Field(default=None, max_length=255)


class CashTxnRead(CashTxnBase):
    id: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }
