from __future__ import annotations

from enum import Enum
from typing import Optional

from sqlalchemy import Enum as SQLEnum, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from .common import TimestampMixin


class VendorType(str, Enum):
    DEALER = "DEALER"
    MECHANIC = "MECHANIC"
    AUCTION = "AUCTION"
    PARTS = "PARTS"
    SERVICE = "SERVICE"
    OTHER = "OTHER"


class Vendor(TimestampMixin, Base):
    __tablename__ = "vendors"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[VendorType] = mapped_column(
        SQLEnum(VendorType, name="vendor_type"), nullable=False, default=VendorType.OTHER
    )
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


__all__ = ["Vendor", "VendorType"]
