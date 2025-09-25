from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .common import TimestampMixin, quantize_decimal


class VehicleStatus(str, Enum):
    STOCK = "STOCK"
    RENTED = "RENTED"
    SOLD = "SOLD"


class Vehicle(TimestampMixin, Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    plate: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    renavam: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    vin: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    model_year: Mapped[int] = mapped_column('year', nullable=False)
    manufacture_year: Mapped[int] = mapped_column(nullable=False)
    make: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    acquisition_date: Mapped[date] = mapped_column(Date, nullable=False)
    acquisition_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    sale_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sale_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    sale_fees: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    current_driver_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True
    )
    odometer_in: Mapped[Optional[int]] = mapped_column(nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[VehicleStatus] = mapped_column(
        SQLEnum(VehicleStatus, name="vehicle_status"), nullable=False, default=VehicleStatus.STOCK
    )

    current_driver = relationship("Driver", back_populates="active_vehicle", foreign_keys=[current_driver_id])
    expenses = relationship("Expense", back_populates="vehicle", cascade="all, delete-orphan")
    rentals = relationship("Rental", back_populates="vehicle", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("acquisition_price >= 0", name="ck_vehicle_acquisition_price_positive"),
        CheckConstraint("sale_price >= 0", name="ck_vehicle_sale_price_positive"),
        CheckConstraint("sale_fees >= 0", name="ck_vehicle_sale_fees_positive"),
        CheckConstraint("manufacture_year >= 1900", name="ck_vehicle_manufacture_year_valid"),
        CheckConstraint("year >= manufacture_year", name="ck_vehicle_model_year_valid"),
        Index("ix_vehicle_make_model", "make", "model"),
    )

    def compute_status(self) -> VehicleStatus:
        if self.sale_date:
            return VehicleStatus.SOLD
        if self.current_driver_id:
            return VehicleStatus.RENTED
        return VehicleStatus.STOCK

    @property
    def total_expenses(self) -> Decimal:
        expenses = self.__dict__.get("expenses")
        if not expenses:
            return Decimal("0")
        total = sum((expense.amount or Decimal("0")) for expense in expenses)
        return quantize_decimal(total) or Decimal("0")

    @property
    def total_cost(self) -> Decimal:
        return quantize_decimal((self.acquisition_price or Decimal("0")) + self.total_expenses)

    @property
    def sale_net(self) -> Optional[Decimal]:
        if self.sale_price is None:
            return None
        fees = self.sale_fees or Decimal("0")
        return quantize_decimal(self.sale_price - fees)

    @property
    def profit(self) -> Optional[Decimal]:
        sale_net = self.sale_net
        if sale_net is None:
            return None
        return quantize_decimal(sale_net - (self.total_cost or Decimal("0")))

    @property
    def roi(self) -> Optional[Decimal]:
        total_cost = self.total_cost or Decimal("0")
        profit = self.profit
        if profit is None or total_cost == 0:
            return None
        return quantize_decimal(profit / total_cost)

    def sync_status(self) -> None:
        self.status = self.compute_status()


__all__ = ["Vehicle", "VehicleStatus"]
