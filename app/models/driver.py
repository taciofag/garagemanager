from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .common import TimestampMixin, quantize_decimal


class DriverStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class Driver(TimestampMixin, Base):
    __tablename__ = "drivers"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    cpf: Mapped[str] = mapped_column(String(14), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    weekly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    commission_pct: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False, default=0)
    deposit_held: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[DriverStatus] = mapped_column(
        SQLEnum(DriverStatus, name="driver_status"), nullable=False, default=DriverStatus.ACTIVE
    )
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    active_vehicle = relationship("Vehicle", back_populates="current_driver", uselist=False)
    rentals = relationship("Rental", back_populates="driver", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("weekly_rate >= 0", name="ck_driver_weekly_rate_positive"),
        CheckConstraint("commission_pct >= 0 AND commission_pct <= 1", name="ck_driver_commission_pct_range"),
        CheckConstraint("deposit_held >= 0", name="ck_driver_deposit_positive"),
    )

    @property
    def weekly_rate_decimal(self) -> Decimal:
        return quantize_decimal(self.weekly_rate)


__all__ = ["Driver", "DriverStatus"]
