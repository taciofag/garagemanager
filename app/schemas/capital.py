from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from ..models.capital import CapitalType
from .common import DecimalModel


class CapitalBase(DecimalModel):
    partner: str = Field(max_length=100)
    date: date
    type: CapitalType
    amount: Decimal
    notes: Optional[str] = Field(default=None, max_length=255)


class CapitalCreate(CapitalBase):
    id: Optional[str] = Field(default=None, max_length=12)


class CapitalUpdate(DecimalModel):
    partner: Optional[str] = Field(default=None, max_length=100)
    date: Optional[date] = None
    type: Optional[CapitalType] = None
    amount: Optional[Decimal] = None
    notes: Optional[str] = Field(default=None, max_length=255)


class CapitalRead(CapitalBase):
    id: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }
