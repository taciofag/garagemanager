from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CashCategoryBase(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = True


class CashCategoryCreate(CashCategoryBase):
    pass


class CashCategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=255)
    is_active: Optional[bool] = None


class CashCategoryRead(CashCategoryBase):
    id: str
    slug: str
    is_system: bool

    model_config = {"from_attributes": True}

