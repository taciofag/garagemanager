from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Enum as SQLEnum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from .common import TimestampMixin


class DocumentEntityType(str, Enum):
    VEHICLE = "vehicle"
    DRIVER = "driver"
    RENTAL = "rental"


class Document(TimestampMixin, Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    entity_type: Mapped[DocumentEntityType] = mapped_column(
        SQLEnum(DocumentEntityType, name="document_entity_type"), nullable=False
    )
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)

    __table_args__ = (
        Index("ix_documents_entity", "entity_type", "entity_id"),
        Index("ix_documents_stored_name", "stored_name", unique=True),
    )


__all__ = ["Document", "DocumentEntityType"]
