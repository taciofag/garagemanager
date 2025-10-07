from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from sqlalchemy import Date, Enum as SQLEnum, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from decimal import Decimal

from .common import TimestampMixin, quantize_decimal


class MaintenanceCategory(str, Enum):
    INSURANCE = "INSURANCE"
    TRACKER = "TRACKER"
    OIL_CHANGE = "OIL_CHANGE"
    TIRES = "TIRES"
    IPVA = "IPVA"
    INSPECTION = "INSPECTION"
    SERVICE = "SERVICE"
    OTHER = "OTHER"


class MaintenanceFrequency(str, Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMIANNUAL = "SEMIANNUAL"
    ANNUAL = "ANNUAL"
    KILOMETER = "KILOMETER"
    ON_DEMAND = "ON_DEMAND"


class MaintenanceStatus(str, Enum):
    OPEN = "OPEN"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class VehicleMaintenance(TimestampMixin, Base):
    __tablename__ = "vehicle_maintenance"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    series_id: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    vehicle_id: Mapped[str] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[MaintenanceCategory] = mapped_column(
        SQLEnum(MaintenanceCategory, name="maintenance_category"), nullable=False
    )
    frequency: Mapped[Optional[MaintenanceFrequency]] = mapped_column(
        SQLEnum(MaintenanceFrequency, name="maintenance_frequency"), nullable=True
    )
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    odometer_due: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[MaintenanceStatus] = mapped_column(
        SQLEnum(MaintenanceStatus, name="maintenance_status"), nullable=False, default=MaintenanceStatus.OPEN
    )
    completed_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    vendor_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True
    )

    vehicle = relationship("Vehicle", back_populates="maintenance_items", lazy="joined")
    vendor = relationship("Vendor", lazy="joined")

    __table_args__ = (
        Index("ix_vehicle_maintenance_status", "status"),
        Index("ix_vehicle_maintenance_due_date", "due_date"),
    )

    @property
    def amount_decimal(self) -> Decimal:
        return quantize_decimal(self.amount) or Decimal("0")

    @property
    def vendor_name(self) -> Optional[str]:
        vendor = getattr(self, "vendor", None)
        if vendor is None:
            return None
        return getattr(vendor, "name", None)


__all__ = [
    "VehicleMaintenance",
    "MaintenanceCategory",
    "MaintenanceFrequency",
    "MaintenanceStatus",
]
