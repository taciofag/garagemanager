from __future__ import annotations

from decimal import Decimal
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, field_validator


T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 25
    order_by: Optional[str] = None
    order_dir: str = "asc"

    @field_validator("page", "page_size")
    @classmethod
    def positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Must be positive")
        return v

    @field_validator("order_dir")
    @classmethod
    def valid_order_dir(cls, v: str) -> str:
        if v not in {"asc", "desc"}:
            raise ValueError("order_dir must be 'asc' or 'desc'")
        return v


class PaginatedResult(BaseModel, Generic[T]):
    total: int
    items: list[T]
    page: int
    page_size: int


class DecimalModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def ensure_decimal(cls, v):  # type: ignore[no-untyped-def]
        if isinstance(v, float):
            return Decimal(str(v))
        return v

    model_config = {
        "json_encoders": {Decimal: lambda v: str(v)},
        "from_attributes": True,
    }
