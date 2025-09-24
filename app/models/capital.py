from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from .common import TimestampMixin


class CapitalType(str, Enum):
    CONTRIBUTION = "Contribution"
    WITHDRAWAL = "Withdrawal"


class CapitalEntry(TimestampMixin, Base):
    __tablename__ = "capital_entries"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    partner: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[CapitalType] = mapped_column(
        SQLEnum(CapitalType, name="capital_type"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_capital_amount_positive"),
    )


__all__ = ["CapitalEntry", "CapitalType"]
