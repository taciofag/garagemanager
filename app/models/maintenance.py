from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .cash import CashTxn
from .common import TimestampMixin, quantize_decimal


class MaintenanceFrequency(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"
    WEEKLY = "weekly"
    ON_DEMAND = "on_demand"


class MaintenanceSeriesStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELED = "canceled"


class MaintenanceOccurrenceStatus(str, Enum):
    OPEN = "open"
    PAID = "paid"
    IGNORED = "ignored"
    CANCELED = "canceled"


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class MaintenanceSeries(TimestampMixin, Base):
    __tablename__ = "maintenance_series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[str] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    supplier_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    frequency: Mapped[MaintenanceFrequency] = mapped_column(
        SQLEnum(
            MaintenanceFrequency,
            name="maintenance_frequency_v2",
            values_callable=_enum_values,
            validate_strings=True,
        ),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    day_rule: Mapped[str] = mapped_column(String(20), nullable=False, default="same_day")
    status: Mapped[MaintenanceSeriesStatus] = mapped_column(
        SQLEnum(
            MaintenanceSeriesStatus,
            name="maintenance_series_status",
            values_callable=_enum_values,
            validate_strings=True,
        ),
        nullable=False,
        default=MaintenanceSeriesStatus.ACTIVE,
    )
    next_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    last_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    vehicle = relationship("Vehicle", back_populates="maintenance_series")
    supplier = relationship("Vendor", lazy="joined")
    occurrences = relationship(
        "MaintenanceOccurrence",
        back_populates="series",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def normalized_amount(self) -> Decimal:
        return quantize_decimal(self.amount) or Decimal("0")

    @property
    def vehicle_label(self) -> str:
        vehicle = getattr(self, "vehicle", None)
        if not vehicle:
            return self.vehicle_id
        parts = [vehicle.plate and vehicle.plate.upper(), vehicle.make, vehicle.model]
        return " · ".join([part for part in parts if part]) or self.vehicle_id


class MaintenanceOccurrence(TimestampMixin, Base):
    __tablename__ = "maintenance_occurrence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    series_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_series.id", ondelete="CASCADE"), nullable=False
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[MaintenanceOccurrenceStatus] = mapped_column(
        SQLEnum(
            MaintenanceOccurrenceStatus,
            name="maintenance_occurrence_status",
            values_callable=_enum_values,
            validate_strings=True,
        ),
        nullable=False,
        default=MaintenanceOccurrenceStatus.OPEN,
        index=True,
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cash_txn_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("cash_txns.id", ondelete="SET NULL"), nullable=True, index=True
    )

    series = relationship("MaintenanceSeries", back_populates="occurrences")
    cash_txn = relationship("CashTxn")

    __table_args__ = (
        UniqueConstraint("series_id", "due_date", name="uq_occurrence_series_due_date"),
        Index("ix_occurrence_due_date", "due_date"),
        Index("ix_occurrence_status_due", "status", "due_date"),
    )

    def normalized_amount(self) -> Decimal:
        return quantize_decimal(self.amount) or Decimal("0")


__all__ = [
    "MaintenanceSeries",
    "MaintenanceOccurrence",
    "MaintenanceFrequency",
    "MaintenanceSeriesStatus",
    "MaintenanceOccurrenceStatus",
]
