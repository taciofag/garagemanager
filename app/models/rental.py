from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .common import TimestampMixin, quantize_decimal


class BillingDay(str, Enum):
    MON = "Mon"
    TUE = "Tue"
    WED = "Wed"
    THU = "Thu"
    FRI = "Fri"
    SAT = "Sat"
    SUN = "Sun"


class RentalStatus(str, Enum):
    ACTIVE = "Active"
    PAUSED = "Paused"
    CLOSED = "Closed"


class Rental(TimestampMixin, Base):
    __tablename__ = "rentals"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    driver_id: Mapped[str] = mapped_column(ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    weekly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    deposit: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    billing_day: Mapped[BillingDay] = mapped_column(
        SQLEnum(BillingDay, name="billing_day"), nullable=False
    )
    status: Mapped[RentalStatus] = mapped_column(
        SQLEnum(RentalStatus, name="rental_status"), nullable=False, default=RentalStatus.ACTIVE
    )
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    vehicle = relationship("Vehicle", back_populates="rentals")
    driver = relationship("Driver", back_populates="rentals")
    payments = relationship("RentPayment", back_populates="rental", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("weekly_rate >= 0", name="ck_rental_weekly_rate_positive"),
        CheckConstraint("deposit >= 0", name="ck_rental_deposit_positive"),
        Index("ix_rental_status", "status"),
    )

    @property
    def weekly_rate_decimal(self) -> Decimal:
        return quantize_decimal(self.weekly_rate)


__all__ = ["Rental", "RentalStatus", "BillingDay"]
