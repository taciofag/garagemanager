from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from ..models.maintenance import (
    MaintenanceFrequency,
    MaintenanceOccurrenceStatus,
    MaintenanceSeriesStatus,
)

DAY_RULE_PATTERN = re.compile(r"^(same_day|fixed_day:(?:[1-9]|[12][0-9]|3[01]))$")


class MaintenanceSeriesBase(BaseModel):
    vehicle_id: str = Field(max_length=12)
    title: str = Field(max_length=120)
    category: Optional[str] = Field(default=None, max_length=80)
    supplier_id: Optional[str] = Field(default=None, max_length=12)
    frequency: MaintenanceFrequency
    start_date: date
    end_date: Optional[date] = None
    amount: Decimal = Decimal("0")
    day_rule: str = Field(default="same_day")

    @model_validator(mode="after")
    def validate_day_rule(self) -> "MaintenanceSeriesBase":
        if not DAY_RULE_PATTERN.match(self.day_rule):
            raise ValueError("day_rule deve ser 'same_day' ou 'fixed_day:<1-31>'")
        return self


class MaintenanceSeriesCreate(MaintenanceSeriesBase):
    status: MaintenanceSeriesStatus = MaintenanceSeriesStatus.ACTIVE


class MaintenanceSeriesUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    category: Optional[str] = Field(default=None, max_length=80)
    supplier_id: Optional[str] = Field(default=None, max_length=12)
    frequency: Optional[MaintenanceFrequency] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    amount: Optional[Decimal] = None
    day_rule: Optional[str] = Field(default=None)
    status: Optional[MaintenanceSeriesStatus] = None

    @model_validator(mode="after")
    def validate_day_rule(self) -> "MaintenanceSeriesUpdate":
        if self.day_rule is not None and not DAY_RULE_PATTERN.match(self.day_rule):
            raise ValueError("day_rule deve ser 'same_day' ou 'fixed_day:<1-31>'")
        return self


class MaintenanceSeriesRead(MaintenanceSeriesBase):
    id: int
    status: MaintenanceSeriesStatus
    next_due_date: Optional[date] = None
    last_generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    vehicle_label: str
    supplier_name: Optional[str] = None

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }


class MaintenanceOccurrenceBase(BaseModel):
    status: MaintenanceOccurrenceStatus = MaintenanceOccurrenceStatus.OPEN
    note: Optional[str] = None


class MaintenanceOccurrenceRead(BaseModel):
    id: int
    series_id: int
    vehicle_id: str
    vehicle_label: str
    title: str
    category: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    due_date: date
    frequency: MaintenanceFrequency
    amount: Decimal
    status: MaintenanceOccurrenceStatus
    paid_at: Optional[datetime] = None
    note: Optional[str] = None
    cash_txn_id: Optional[str] = None
    cash_category_id: Optional[str] = None
    cash_payment_method: Optional[str] = None

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: str(v)},
    }


class MaintenanceSummary(BaseModel):
    open: int
    overdue: int
    expected_this_month: Decimal
    paid_this_month: Decimal

    model_config = {
        "json_encoders": {Decimal: lambda v: str(v)},
    }


class MaintenanceOccurrencesResponse(BaseModel):
    summary: MaintenanceSummary
    items: list[MaintenanceOccurrenceRead]
    total: int
    page: int
    page_size: int


class MaintenanceOccurrenceActionResponse(BaseModel):
    occurrence: MaintenanceOccurrenceRead
    summary: MaintenanceSummary


class MaintenanceOccurrenceActionRequest(BaseModel):
    paid_at: Optional[date] = None
    note: Optional[str] = None
    cash_category_id: Optional[str] = None
    payment_method: Optional[str] = None


__all__ = [
    "MaintenanceSeriesCreate",
    "MaintenanceSeriesUpdate",
    "MaintenanceSeriesRead",
    "MaintenanceOccurrenceRead",
    "MaintenanceSummary",
    "MaintenanceOccurrencesResponse",
    "MaintenanceOccurrenceActionResponse",
]
