from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.expense import ExpenseCategory
from .common import DecimalModel


class ExpenseBase(DecimalModel):
    vehicle_id: str = Field(max_length=12)
    date: date
    vendor_id: Optional[str] = Field(default=None, max_length=12)
    category: ExpenseCategory
    description: str = Field(max_length=255)
    invoice_no: Optional[str] = Field(default=None, max_length=50)
    amount: Decimal
    paid_with: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=255)


class ExpenseCreate(ExpenseBase):
    id: Optional[str] = Field(default=None, max_length=12)


class ExpenseUpdate(DecimalModel):
    vehicle_id: Optional[str] = Field(default=None, max_length=12)
    date: Optional[date] = None
    vendor_id: Optional[str] = Field(default=None, max_length=12)
    category: Optional[ExpenseCategory] = None
    description: Optional[str] = Field(default=None, max_length=255)
    invoice_no: Optional[str] = Field(default=None, max_length=50)
    amount: Optional[Decimal] = None
    paid_with: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=255)


class ExpenseRead(ExpenseBase):
    id: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }
