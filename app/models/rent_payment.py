from __future__ import annotations

from datetime import date
from decimal import Decimal
from math import ceil
from typing import Optional

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .common import TimestampMixin, quantize_decimal


class RentPayment(TimestampMixin, Base):
    __tablename__ = "rent_payments"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    rental_id: Mapped[str] = mapped_column(ForeignKey("rentals.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    weekly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    weeks: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    due_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    late_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    rental = relationship("Rental", back_populates="payments")

    __table_args__ = (
        Index("ix_rent_payment_period", "period_start", "period_end"),
        CheckConstraint("weeks > 0", name="ck_rentpayment_weeks_positive"),
        CheckConstraint("due_amount >= 0", name="ck_rentpayment_due_positive"),
        CheckConstraint("paid_amount >= 0", name="ck_rentpayment_paid_positive"),
        CheckConstraint("late_fee >= 0", name="ck_rentpayment_late_fee_positive"),
    )

    def recompute_totals(self) -> None:
        delta_days = (self.period_end - self.period_start).days + 1
        computed_weeks = max(1, ceil(delta_days / 7))
        self.weeks = computed_weeks
        weekly_rate = quantize_decimal(self.weekly_rate) or Decimal("0")
        due = weekly_rate * Decimal(self.weeks)
        self.due_amount = quantize_decimal(due) or Decimal("0")
        paid = quantize_decimal(self.paid_amount) or Decimal("0")
        late_fee = quantize_decimal(self.late_fee) or Decimal("0")
        self.paid_amount = paid
        self.late_fee = late_fee

    @property
    def balance(self) -> Decimal:
        due = quantize_decimal(self.due_amount) or Decimal("0")
        late_fee = quantize_decimal(self.late_fee) or Decimal("0")
        paid = quantize_decimal(self.paid_amount) or Decimal("0")
        return quantize_decimal(due + late_fee - paid) or Decimal("0")


__all__ = ["RentPayment"]
