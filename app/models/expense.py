from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .common import TimestampMixin


class ExpenseCategory(str, Enum):
    PARTS = "Parts"
    REPAIR = "Repair"
    TOWING = "Towing"
    DOCS = "Docs"
    AUCTION_FEE = "AuctionFee"
    TRANSFER = "Transfer"
    INSPECTION = "Inspection"
    OTHER = "Other"


class Expense(TimestampMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    vendor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[ExpenseCategory] = mapped_column(
        SQLEnum(ExpenseCategory, name="expense_category"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    paid_with: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    vehicle = relationship("Vehicle", back_populates="expenses")
    vendor = relationship("Vendor")

    __table_args__ = (
        Index("ix_expense_vehicle_date", "vehicle_id", "date"),
        CheckConstraint("amount >= 0", name="ck_expense_amount_positive"),
    )


__all__ = ["Expense", "ExpenseCategory"]
