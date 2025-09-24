from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .common import TimestampMixin


class CashTxnType(str, Enum):
    INFLOW = "Inflow"
    OUTFLOW = "Outflow"


class CashTxn(TimestampMixin, Base):
    __tablename__ = "cash_txns"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[CashTxnType] = mapped_column(
        SQLEnum(CashTxnType, name="cash_type"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    related_vehicle_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True
    )
    related_rental_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("rentals.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    related_vehicle = relationship("Vehicle")
    related_rental = relationship("Rental")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_cash_amount_positive"),
    )


__all__ = ["CashTxn", "CashTxnType"]
